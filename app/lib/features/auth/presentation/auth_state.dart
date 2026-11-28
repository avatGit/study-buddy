import '../../../core/errors/app_failure.dart';
import '../domain/study_user.dart';

enum AuthStatus { restoring, unauthenticated, submitting, authenticated }

class AuthState {
  const AuthState({
    required this.status,
    this.user,
    this.failure,
    this.successMessage,
  });

  const AuthState.restoring() : this(status: AuthStatus.restoring);
  const AuthState.unauthenticated() : this(status: AuthStatus.unauthenticated);

  final AuthStatus status;
  final StudyUser? user;
  final AppFailure? failure;
  final String? successMessage;

  bool get isAuthenticated => status == AuthStatus.authenticated;
  Map<String, String> get fieldErrors => failure?.fieldErrors ?? const {};
}
