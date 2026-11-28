import 'package:flutter_test/flutter_test.dart';
import 'package:studybuddy_app/core/router/app_router.dart';
import 'package:studybuddy_app/features/auth/presentation/auth_state.dart';

void main() {
  test('redirects a signed-out visitor to authentication', () {
    expect(authRedirect(const AuthState.unauthenticated(), '/home'), '/auth');
    expect(authRedirect(const AuthState.unauthenticated(), '/auth'), isNull);
  });

  test('sends an authenticated user to home and allows guarded routes', () {
    const authenticated = AuthState(status: AuthStatus.authenticated);
    expect(authRedirect(authenticated, '/auth'), '/home');
    expect(authRedirect(authenticated, '/sessions'), isNull);
  });

  test(
    'keeps startup on the restoration screen until session check completes',
    () {
      expect(authRedirect(const AuthState.restoring(), '/'), isNull);
      expect(authRedirect(const AuthState.restoring(), '/profile'), '/');
    },
  );
}
