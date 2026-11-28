import 'package:dio/dio.dart';

import '../config/app_config.dart';
import '../storage/session_tokens.dart';
import 'api_paths.dart';

class ApiClient {
  ApiClient({required SessionTokens tokens, String? baseUrl})
      : _tokens = tokens,
        _bareDio = Dio(BaseOptions(
          baseUrl: baseUrl ?? AppConfig.apiBaseUrl,
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 20),
          contentType: Headers.jsonContentType,
        )) {
    dio = Dio(_bareDio.options);
    dio.interceptors.add(_AuthInterceptor(_tokens, _bareDio, dio));
  }

  final SessionTokens _tokens;
  final Dio _bareDio;
  late final Dio dio;
}

class _AuthInterceptor extends Interceptor {
  _AuthInterceptor(this._tokens, this._bareDio, this._dio);

  final SessionTokens _tokens;
  final Dio _bareDio;
  final Dio _dio;
  static const _retriedKey = 'studybuddy.auth.retried';

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final token = _tokens.accessToken;
    if (token != null && !_isPublicAuth(options.path)) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }

  @override
  Future<void> onError(DioException error, ErrorInterceptorHandler handler) async {
    final request = error.requestOptions;
    if (error.response?.statusCode != 401 ||
        request.extra[_retriedKey] == true ||
        _isPublicAuth(request.path)) {
      handler.next(error);
      return;
    }

    final refreshed = await _tokens.refresh(_bareDio);
    if (!refreshed) {
      handler.next(error);
      return;
    }
    request
      ..extra[_retriedKey] = true
      ..headers['Authorization'] = 'Bearer ${_tokens.accessToken}';
    try {
      handler.resolve(await _dio.fetch<Object?>(request));
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }

  bool _isPublicAuth(String path) =>
      path == ApiPaths.login || path == ApiPaths.register || path == ApiPaths.refresh;
}
