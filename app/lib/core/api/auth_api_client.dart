import 'dart:async';
import 'package:dio/dio.dart';

import '../session/secure_token_store.dart';
import '../../features/auth/data/auth_models.dart';

class AuthApiClient {
  AuthApiClient({
    required String baseUrl,
    required TokenStore tokenStore,
    Dio? dio,
    Dio? refreshDio,
  }) : _tokenStore = tokenStore,
       _dio = dio ?? Dio(BaseOptions(baseUrl: baseUrl)),
       _refreshDio = refreshDio ?? Dio(BaseOptions(baseUrl: baseUrl)) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          if (!_isAuthEndpoint(options.uri.path)) {
            final tokens = await _tokenStore.read();
            if (tokens != null) {
              options.headers['Authorization'] = 'Bearer ${tokens.accessToken}';
            }
          }
          handler.next(options);
        },
        onError: _handleError,
      ),
    );
  }

  static const _retriedKey = 'studybuddy.authRetried';
  static const _refreshPath = '/api/auth/refresh';
  final TokenStore _tokenStore;
  final Dio _dio;
  final Dio _refreshDio;
  Future<AuthSession?>? _refreshFuture;
  bool _sessionExpiredNotified = false;
  void Function()? onSessionExpired;

  Future<Response<dynamic>> get(
    String path, {
    Map<String, Object?>? queryParameters,
  }) => _dio.get<dynamic>(path, queryParameters: queryParameters);

  Future<Response<dynamic>> post(String path, {Object? data}) =>
      _dio.post<dynamic>(path, data: data);

  Future<AuthSession?> restoreSession() => _refreshSingleFlight();

  Future<void> storeSession(AuthSession session) async {
    await _tokenStore.write(
      StoredTokens(
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
      ),
    );
    _sessionExpiredNotified = false;
  }

  Future<void> clearSession() async {
    await _tokenStore.clear();
    _sessionExpiredNotified = false;
  }

  Future<void> _handleError(
    DioException error,
    ErrorInterceptorHandler handler,
  ) async {
    final request = error.requestOptions;
    if (error.response?.statusCode != 401 ||
        request.extra[_retriedKey] == true ||
        _isAuthEndpoint(request.uri.path)) {
      handler.next(error);
      return;
    }

    StoredTokens? latestTokens;
    try {
      latestTokens = await _tokenStore.read();
    } on FormatException {
      await _expireSession();
      handler.next(error);
      return;
    }
    final requestAuthorization = request.headers['Authorization'];
    if (latestTokens != null &&
        'Bearer ${latestTokens.accessToken}' != requestAuthorization) {
      await _retryWithAccessToken(request, latestTokens.accessToken, handler);
      return;
    }

    final session = await _refreshSingleFlight();
    if (session == null) {
      handler.next(error);
      return;
    }

    await _retryWithAccessToken(request, session.accessToken, handler);
  }

  Future<void> _retryWithAccessToken(
    RequestOptions request,
    String accessToken,
    ErrorInterceptorHandler handler,
  ) async {
    final retryOptions = request.copyWith(
      extra: {...request.extra, _retriedKey: true},
      headers: {...request.headers, 'Authorization': 'Bearer $accessToken'},
    );
    try {
      handler.resolve(await _dio.fetch<dynamic>(retryOptions));
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }

  Future<AuthSession?> _refreshSingleFlight() async {
    final pending = _refreshFuture;
    if (pending != null) return pending;

    final refresh = _performRefresh();
    _refreshFuture = refresh;
    try {
      return await refresh;
    } finally {
      if (identical(_refreshFuture, refresh)) _refreshFuture = null;
    }
  }

  Future<AuthSession?> _performRefresh() async {
    StoredTokens? tokens;
    try {
      tokens = await _tokenStore.read();
    } on FormatException {
      await _expireSession();
      return null;
    }
    if (tokens == null || tokens.refreshToken.isEmpty) {
      await _expireSession();
      return null;
    }

    try {
      final response = await _refreshDio.post<dynamic>(
        _refreshPath,
        data: {'refreshToken': tokens.refreshToken},
      );
      final session = AuthSession.fromJson(response.data);
      await storeSession(session);
      return session;
    } on DioException {
      await _expireSession();
      return null;
    } on FormatException {
      await _expireSession();
      return null;
    }
  }

  Future<void> _expireSession() async {
    await _tokenStore.clear();
    if (_sessionExpiredNotified) return;
    _sessionExpiredNotified = true;
    onSessionExpired?.call();
  }

  bool _isAuthEndpoint(String path) =>
      path == '/api/auth/login' ||
      path == '/api/auth/register' ||
      path == _refreshPath;

  void close() {
    _dio.close(force: true);
    _refreshDio.close(force: true);
  }
}
