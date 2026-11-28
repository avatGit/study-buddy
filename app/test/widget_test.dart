import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:studybuddy_app/core/api/auth_api_client.dart';
import 'package:studybuddy_app/features/auth/data/auth_repository.dart';
import 'package:studybuddy_app/features/auth/presentation/auth_cubit.dart';
import 'package:studybuddy_app/features/auth/presentation/auth_page.dart';
import 'package:studybuddy_app/main.dart';

import 'support/memory_token_store.dart';
import 'support/test_http_adapter.dart';

class RegistrationHarness {
  RegistrationHarness()
    : tokenStore = MemoryTokenStore(),
      submittedBodies = [] {
    adapter = TestHttpAdapter((options) async {
      if (options.uri.path == '/api/universities') {
        return jsonResponse(200, {
          'items': [
            {'id': 'university-1', 'name': 'Example University'},
          ],
          'page': 1,
          'limit': 100,
          'total': 1,
        });
      }
      if (options.uri.path == '/api/auth/register') {
        final body = Map<String, dynamic>.from(options.data as Map);
        submittedBodies.add(body);
        return jsonResponse(201, {
          'user': {
            'id': 'user-1',
            'fullName': body['fullName'],
            'email': body['email'],
            'role': 'USER',
            'universityId': body['universityId'],
          },
          'accessToken': 'access-token',
          'refreshToken': 'refresh-token',
        });
      }
      return jsonResponse(401, {
        'error': {'code': 'UNAUTHENTICATED'},
      });
    });

    final dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
      ..httpClientAdapter = adapter;
    final refreshDio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
      ..httpClientAdapter = adapter;
    client = AuthApiClient(
      baseUrl: 'https://api.example.test',
      tokenStore: tokenStore,
      dio: dio,
      refreshDio: refreshDio,
    );
    cubit = AuthCubit(AuthRepository(client));
  }

  final MemoryTokenStore tokenStore;
  final List<Map<String, dynamic>> submittedBodies;
  late final TestHttpAdapter adapter;
  late final AuthApiClient client;
  late final AuthCubit cubit;

  Future<void> start(WidgetTester tester) async {
    await cubit.restoreSession();
    await tester.pumpWidget(StudyBuddyApp(authCubit: cubit));
    await tester.pumpAndSettle();
  }

  Future<void> register(
    WidgetTester tester, {
    bool chooseUniversity = false,
  }) async {
    await tester.tap(find.text('Register'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.byKey(const Key('fullNameField')),
      'Taylor Student',
    );
    await tester.enterText(
      find.byKey(const Key('emailField')),
      'taylor@example.test',
    );
    await tester.enterText(
      find.byKey(const Key('passwordField')),
      'correct horse battery staple',
    );

    if (chooseUniversity) {
      await tester.tap(find.byKey(const Key('universityDropdown')));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Example University').last);
      await tester.pumpAndSettle();
    }

    await tester.tap(find.byKey(const Key('authSubmitButton')));
    await tester.pumpAndSettle();
  }

  Future<void> close() async {
    await cubit.close();
    client.close();
  }
}

void main() {
  testWidgets(
    'registration selects an optional university and submits the agreed fields',
    (tester) async {
      final harness = RegistrationHarness();
      await harness.start(tester);

      await harness.register(tester, chooseUniversity: true);

      expect(harness.submittedBodies, [
        {
          'fullName': 'Taylor Student',
          'email': 'taylor@example.test',
          'password': 'correct horse battery staple',
          'universityId': 'university-1',
        },
      ]);
      final navigation = tester.widget<NavigationBar>(
        find.byType(NavigationBar),
      );
      expect(navigation.destinations, hasLength(4));
      for (final label in ['Home', 'Search', 'My Sessions', 'Profile']) {
        expect(find.text(label), findsWidgets);
      }
      await harness.close();
    },
  );

  testWidgets('registration can continue without a university', (tester) async {
    final harness = RegistrationHarness();
    await harness.start(tester);
    await harness.register(tester);

    expect(harness.submittedBodies.single, {
      'fullName': 'Taylor Student',
      'email': 'taylor@example.test',
      'password': 'correct horse battery staple',
    });
    await harness.close();
  });

  testWidgets('forgot-password remains disabled and does not navigate', (
    tester,
  ) async {
    final harness = RegistrationHarness();
    await harness.start(tester);

    final button = tester.widget<TextButton>(
      find.byKey(const Key('forgotPasswordButton')),
    );
    expect(button.onPressed, isNull);
    expect(find.textContaining('Coming soon'), findsOneWidget);
    expect(find.textContaining('Admin'), findsNothing);
    expect(find.byType(AuthPage), findsOneWidget);
    await harness.close();
  });
}
