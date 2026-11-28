import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:studybuddy_app/core/api/auth_api_client.dart';
import 'package:studybuddy_app/core/session/secure_token_store.dart';
import 'package:studybuddy_app/features/auth/data/auth_repository.dart';
import 'package:studybuddy_app/features/auth/presentation/auth_cubit.dart';

import 'support/memory_token_store.dart';
import 'support/test_http_adapter.dart';

void main() {
  const user = {
    'id': '000000000000000000000001',
    'fullName': 'Learner Example',
    'email': 'learner@example.test',
    'role': 'USER',
    'universityId': null,
  };

  AuthApiClient createClient({
    required MemoryTokenStore tokenStore,
    required TestHttpAdapter adapter,
  }) {
    final dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'));
    final refreshDio = Dio(BaseOptions(baseUrl: 'https://api.example.test'));
    dio.httpClientAdapter = adapter;
    refreshDio.httpClientAdapter = adapter;
    return AuthApiClient(
      baseUrl: 'https://api.example.test',
      tokenStore: tokenStore,
      dio: dio,
      refreshDio: refreshDio,
    );
  }

  test(
    'concurrent 401s share one refresh and each request retries once',
    () async {
      var refreshCalls = 0;
      var protectedCalls = 0;
      final tokenStore = MemoryTokenStore()
        ..tokens = const StoredTokens(
          accessToken: 'expired-access',
          refreshToken: 'current-refresh',
        );
      final adapter = TestHttpAdapter((options) async {
        if (options.uri.path == '/api/auth/refresh') {
          refreshCalls += 1;
          await Future<void>.delayed(const Duration(milliseconds: 20));
          return jsonResponse(200, {
            'user': user,
            'accessToken': 'fresh-access',
            'refreshToken': 'rotated-refresh',
          });
        }

        protectedCalls += 1;
        if (options.headers['Authorization'] != 'Bearer fresh-access') {
          return jsonResponse(401, {
            'error': {'code': 'UNAUTHENTICATED'},
          });
        }
        return jsonResponse(200, {'ok': true});
      });
      final client = createClient(tokenStore: tokenStore, adapter: adapter);

      final responses = await Future.wait([
        client.get('/api/protected/one'),
        client.get('/api/protected/two'),
      ]);

      expect(responses.map((response) => response.statusCode), [200, 200]);
      expect(refreshCalls, 1);
      expect(protectedCalls, 4);
      expect(tokenStore.tokens?.accessToken, 'fresh-access');
      expect(tokenStore.tokens?.refreshToken, 'rotated-refresh');
      client.close();
    },
  );

  test(
    'startup restores the user from refresh without an extra current-user call',
    () async {
      var refreshCalls = 0;
      var meCalls = 0;
      final tokenStore = MemoryTokenStore()
        ..tokens = const StoredTokens(
          accessToken: 'expired-access',
          refreshToken: 'current-refresh',
        );
      final adapter = TestHttpAdapter((options) async {
        if (options.uri.path == '/api/auth/refresh') {
          refreshCalls += 1;
          return jsonResponse(200, {
            'user': user,
            'accessToken': 'fresh-access',
            'refreshToken': 'rotated-refresh',
          });
        }
        if (options.uri.path == '/api/users/me') meCalls += 1;
        return jsonResponse(200, {'user': user});
      });
      final client = createClient(tokenStore: tokenStore, adapter: adapter);
      final cubit = AuthCubit(AuthRepository(client));

      await cubit.restoreSession();

      expect(cubit.state.status, AuthStatus.signedIn);
      expect(cubit.state.user?.id, user['id']);
      expect(refreshCalls, 1);
      expect(meCalls, 0);
      expect(tokenStore.tokens?.accessToken, 'fresh-access');
      expect(tokenStore.tokens?.refreshToken, 'rotated-refresh');
      await cubit.close();
      client.close();
    },
  );

  test(
    'a late 401 reuses credentials already rotated by another request',
    () async {
      var refreshCalls = 0;
      var protectedCalls = 0;
      final tokenStore = MemoryTokenStore()
        ..tokens = const StoredTokens(
          accessToken: 'expired-access',
          refreshToken: 'current-refresh',
        );
      final adapter = TestHttpAdapter((options) async {
        if (options.uri.path == '/api/auth/refresh') {
          refreshCalls += 1;
          await Future<void>.delayed(const Duration(milliseconds: 10));
          return jsonResponse(200, {
            'user': user,
            'accessToken': 'fresh-access',
            'refreshToken': 'rotated-refresh',
          });
        }

        protectedCalls += 1;
        if (options.uri.path.endsWith('/late')) {
          await Future<void>.delayed(const Duration(milliseconds: 40));
        }
        if (options.headers['Authorization'] != 'Bearer fresh-access') {
          return jsonResponse(401, {
            'error': {'code': 'UNAUTHENTICATED'},
          });
        }
        return jsonResponse(200, {'ok': true});
      });
      final client = createClient(tokenStore: tokenStore, adapter: adapter);

      await Future.wait([
        client.get('/api/protected/fast'),
        client.get('/api/protected/late'),
      ]);

      expect(refreshCalls, 1);
      expect(protectedCalls, 4);
      client.close();
    },
  );

  test(
    'does not refresh recursively after a retried request receives 401',
    () async {
      var refreshCalls = 0;
      var protectedCalls = 0;
      final tokenStore = MemoryTokenStore()
        ..tokens = const StoredTokens(
          accessToken: 'expired-access',
          refreshToken: 'current-refresh',
        );
      final adapter = TestHttpAdapter((options) async {
        if (options.uri.path == '/api/auth/refresh') {
          refreshCalls += 1;
          return jsonResponse(200, {
            'user': user,
            'accessToken': 'fresh-access',
            'refreshToken': 'rotated-refresh',
          });
        }
        protectedCalls += 1;
        return jsonResponse(401, {
          'error': {'code': 'UNAUTHENTICATED'},
        });
      });
      final client = createClient(tokenStore: tokenStore, adapter: adapter);

      await expectLater(
        client.get('/api/protected'),
        throwsA(isA<DioException>()),
      );
      expect(protectedCalls, 2);
      expect(refreshCalls, 1);

      await expectLater(
        client.post('/api/auth/login', data: const {}),
        throwsA(isA<DioException>()),
      );
      expect(refreshCalls, 1);
      client.close();
    },
  );

  test('refresh failure clears stored credentials and notifies once', () async {
    var refreshCalls = 0;
    final tokenStore = MemoryTokenStore()
      ..tokens = const StoredTokens(
        accessToken: 'expired-access',
        refreshToken: 'invalid-refresh',
      );
    final adapter = TestHttpAdapter((options) async {
      if (options.uri.path == '/api/auth/login') {
        return jsonResponse(200, {
          'user': user,
          'accessToken': 'expired-access',
          'refreshToken': 'invalid-refresh',
        });
      }
      if (options.uri.path == '/api/auth/refresh') {
        refreshCalls += 1;
        return jsonResponse(401, {
          'error': {'code': 'UNAUTHENTICATED'},
        });
      }
      return jsonResponse(401, {
        'error': {'code': 'UNAUTHENTICATED'},
      });
    });
    final client = createClient(tokenStore: tokenStore, adapter: adapter);
    final cubit = AuthCubit(AuthRepository(client));
    await cubit.login('learner@example.test', 'correct horse battery staple');
    var signedOutTransitions = 0;
    final subscription = cubit.stream.listen((state) {
      if (state.status == AuthStatus.signedOut) signedOutTransitions += 1;
    });

    await Future.wait([
      expectLater(
        client.get('/api/protected/one'),
        throwsA(isA<DioException>()),
      ),
      expectLater(
        client.get('/api/protected/two'),
        throwsA(isA<DioException>()),
      ),
    ]);

    expect(refreshCalls, 1);
    expect(tokenStore.tokens, isNull);
    await Future<void>.delayed(Duration.zero);
    expect(cubit.state.status, AuthStatus.signedOut);
    expect(signedOutTransitions, 1);
    await subscription.cancel();
    await cubit.close();
    client.close();
  });
}
