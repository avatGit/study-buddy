import 'dart:async';
import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:studybuddy_app/core/network/api_client.dart';
import 'package:studybuddy_app/core/storage/session_tokens.dart';
import 'package:studybuddy_app/core/storage/token_store.dart';

class _MemoryTokenStore implements TokenStore {
  String? token;

  @override
  Future<String?> readRefreshToken() async => token;

  @override
  Future<void> writeRefreshToken(String value) async => token = value;

  @override
  Future<void> clear() async => token = null;
}

class _AuthAdapter implements HttpClientAdapter {
  final firstUnauthorizedWave = Completer<void>();
  var protectedRequests = 0;
  var refreshRequests = 0;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    if (options.path == '/api/auth/refresh') {
      refreshRequests++;
      await Future<void>.delayed(const Duration(milliseconds: 30));
      return _jsonResponse({
        'user': {'id': '1', 'email': 'lea@example.test', 'role': 'USER'},
        'accessToken': 'fresh-access',
        'refreshToken': 'fresh-refresh',
      });
    }
    protectedRequests++;
    final authorization = options.headers['Authorization'];
    if (authorization == 'Bearer fresh-access') {
      return _jsonResponse({'ok': true});
    }
    if (protectedRequests == 2) firstUnauthorizedWave.complete();
    await firstUnauthorizedWave.future;
    return _jsonResponse({'error': {'code': 'UNAUTHENTICATED'}}, status: 401);
  }

  ResponseBody _jsonResponse(Object body, {int status = 200}) => ResponseBody.fromString(
        jsonEncode(body),
        status,
        headers: {Headers.contentTypeHeader: [Headers.jsonContentType]},
      );

  @override
  void close({bool force = false}) {}
}

void main() {
  test('parallel 401 responses share one refresh and replay each request once', () async {
    final store = _MemoryTokenStore()..token = 'old-refresh';
    final tokens = SessionTokens(store);
    await tokens.save(accessToken: 'expired-access', refreshToken: 'old-refresh');
    final adapter = _AuthAdapter();
    final client = ApiClient(tokens: tokens, adapter: adapter);
    addTearDown(client.close);

    final responses = await Future.wait([
      client.dio.get<Object?>('/api/private/one'),
      client.dio.get<Object?>('/api/private/two'),
    ]);

    expect(responses, hasLength(2));
    expect(adapter.refreshRequests, 1);
    expect(adapter.protectedRequests, 4);
    expect(tokens.accessToken, 'fresh-access');
    expect(await tokens.refreshToken, 'fresh-refresh');
  });
}
