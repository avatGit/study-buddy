import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:studybuddy_app/core/network/api_client.dart';
import 'package:studybuddy_app/core/storage/session_tokens.dart';
import 'package:studybuddy_app/core/storage/token_store.dart';
import 'package:studybuddy_app/features/auth/data/api_auth_repository.dart';

class _MemoryTokenStore implements TokenStore {
  String? value;

  @override
  Future<String?> readRefreshToken() async => value;

  @override
  Future<void> writeRefreshToken(String token) async => value = token;

  @override
  Future<void> clear() async => value = null;
}

class _RequestAdapter implements HttpClientAdapter {
  Object? registrationBody;
  final universityQueries = <Map<String, dynamic>>[];
  int universityCount = 1;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    if (options.path == '/api/auth/register') {
      final body = options.data;
      registrationBody = body is String ? jsonDecode(body) : body;
      return _json({
        'user': {
          'id': 'user-1',
          'fullName': 'Aïcha Diallo',
          'email': 'aicha@example.test',
          'role': 'USER',
          'universityId': '670000000000000000000001',
        },
        'accessToken': 'access-token',
        'refreshToken': 'refresh-token',
      });
    }
    final query = Map<String, dynamic>.from(options.queryParameters);
    universityQueries.add(query);
    final page = query['page'] as int;
    final start = (page - 1) * 100;
    final end = (start + 100).clamp(0, universityCount);
    return _json({
      'items': [
        for (var index = start; index < end; index++)
          {
            'id': (index + 1).toRadixString(16).padLeft(24, '0'),
            'name': 'Université ${index + 1}',
          },
      ],
      'page': page,
      'limit': 100,
      'total': universityCount,
    });
  }

  ResponseBody _json(Object body) => ResponseBody.fromString(
        jsonEncode(body),
        200,
        headers: {Headers.contentTypeHeader: [Headers.jsonContentType]},
      );

  @override
  void close({bool force = false}) {}
}

void main() {
  test('sends the API registration schema fields and optional university ID', () async {
    final tokens = SessionTokens(_MemoryTokenStore());
    final adapter = _RequestAdapter();
    final client = ApiClient(tokens: tokens, adapter: adapter);
    addTearDown(client.close);
    final repository = ApiAuthRepository(client: client, tokens: tokens);

    await repository.register(
      fullName: ' Aïcha Diallo ',
      email: ' aicha@example.test ',
      password: 'A secure password 123',
      universityId: '670000000000000000000001',
    );

    expect(adapter.registrationBody, {
      'fullName': 'Aïcha Diallo',
      'email': 'aicha@example.test',
      'password': 'A secure password 123',
      'universityId': '670000000000000000000001',
    });

    await repository.register(
      fullName: 'Aïcha Diallo',
      email: 'aicha@example.test',
      password: 'A secure password 123',
    );
    expect(adapter.registrationBody, {
      'fullName': 'Aïcha Diallo',
      'email': 'aicha@example.test',
      'password': 'A secure password 123',
    });
  });

  test('loads every page of the university catalogue', () async {
    final tokens = SessionTokens(_MemoryTokenStore());
    final adapter = _RequestAdapter();
    adapter.universityCount = 101;
    final client = ApiClient(tokens: tokens, adapter: adapter);
    addTearDown(client.close);
    final repository = ApiAuthRepository(client: client, tokens: tokens);

    final options = await repository.universities();

    expect(adapter.universityQueries, [
      {'page': 1, 'limit': 100},
      {'page': 2, 'limit': 100},
    ]);
    expect(options, hasLength(101));
    expect(options.first.id, '000000000000000000000001');
    expect(options.first.name, 'Université 1');
    expect(options.last.name, 'Université 101');
  });
}
