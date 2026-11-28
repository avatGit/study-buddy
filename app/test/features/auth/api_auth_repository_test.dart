import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:studybuddy_app/core/network/api_client.dart';
import 'package:studybuddy_app/core/storage/session_tokens.dart';
import 'package:studybuddy_app/core/storage/token_store.dart';
import 'package:studybuddy_app/features/auth/data/api_auth_repository.dart';

class _MemoryTokenStore implements TokenStore {
  _MemoryTokenStore(this.value);
  String? value;

  @override
  Future<String?> readRefreshToken() async => value;

  @override
  Future<void> writeRefreshToken(String token) async => value = token;

  @override
  Future<void> clear() async => value = null;
}

class _RestoreAdapter implements HttpClientAdapter {
  final paths = <String>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    paths.add(options.path);
    if (options.path == '/api/auth/refresh') {
      return _response({
        'user': {
          'id': 'user-1',
          'fullName': 'Aïcha Diallo',
          'email': 'aicha@example.test',
          'role': 'USER',
          'universityId': null,
        },
        'accessToken': 'fresh-access',
        'refreshToken': 'rotated-refresh',
      });
    }
    expect(options.path, '/api/users/me');
    expect(options.headers['Authorization'], 'Bearer fresh-access');
    return _response({
      'user': {
        'id': 'user-1',
        'fullName': 'Aïcha Diallo',
        'email': 'aicha@example.test',
        'role': 'USER',
        'universityId': null,
      },
    });
  }

  ResponseBody _response(Object body) => ResponseBody.fromString(
        jsonEncode(body),
        200,
        headers: {Headers.contentTypeHeader: [Headers.jsonContentType]},
      );

  @override
  void close({bool force = false}) {}
}

void main() {
  test('restores by rotating the saved refresh token then reading /users/me', () async {
    final store = _MemoryTokenStore('old-refresh');
    final tokens = SessionTokens(store);
    final adapter = _RestoreAdapter();
    final client = ApiClient(tokens: tokens, adapter: adapter);
    addTearDown(client.close);
    final repository = ApiAuthRepository(client: client, tokens: tokens);

    final user = await repository.restoreSession();

    expect(adapter.paths, ['/api/auth/refresh', '/api/users/me']);
    expect(user?.id, 'user-1');
    expect(user?.fullName, 'Aïcha Diallo');
    expect(await tokens.refreshToken, 'rotated-refresh');
  });

  test('does not make requests when no refresh credential is stored', () async {
    final tokens = SessionTokens(_MemoryTokenStore(null));
    final adapter = _RestoreAdapter();
    final client = ApiClient(tokens: tokens, adapter: adapter);
    addTearDown(client.close);

    expect(await ApiAuthRepository(client: client, tokens: tokens).restoreSession(), isNull);
    expect(adapter.paths, isEmpty);
  });
}
