import 'package:dio/dio.dart';

import '../network/api_paths.dart';
import 'token_store.dart';

class SessionTokens {
  SessionTokens(this._store);

  final TokenStore _store;
  String? _accessToken;
  Future<bool>? _refreshing;

  String? get accessToken => _accessToken;
  Future<String?> get refreshToken => _store.readRefreshToken();

  Future<void> save({required String accessToken, required String refreshToken}) async {
    _accessToken = accessToken;
    await _store.writeRefreshToken(refreshToken);
  }

  Future<void> clear() async {
    _accessToken = null;
    await _store.clear();
  }

  Future<bool> refresh(Dio bareDio) {
    final current = _refreshing;
    if (current != null) return current;
    final result = _performRefresh(bareDio);
    _refreshing = result;
    return result.whenComplete(() => _refreshing = null);
  }

  Future<bool> _performRefresh(Dio bareDio) async {
    final token = await _store.readRefreshToken();
    if (token == null || token.isEmpty) return false;
    try {
      final response = await bareDio.post<Object?>(
        ApiPaths.refresh,
        data: {'refreshToken': token},
      );
      final body = response.data;
      if (body is! Map || body['accessToken'] is! String || body['refreshToken'] is! String) {
        await clear();
        return false;
      }
      await save(
        accessToken: body['accessToken'] as String,
        refreshToken: body['refreshToken'] as String,
      );
      return true;
    } on DioException {
      await clear();
      return false;
    }
  }
}
