import 'package:bloc_test/bloc_test.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:studybuddy_app/core/errors/app_failure.dart';
import 'package:studybuddy_app/features/auth/domain/auth_repository.dart';
import 'package:studybuddy_app/features/auth/domain/study_user.dart';
import 'package:studybuddy_app/features/auth/presentation/auth_cubit.dart';
import 'package:studybuddy_app/features/auth/presentation/auth_state.dart';

class _Repository implements AuthRepository {
  _Repository({this.loginResult, this.loginFailure});

  final StudyUser? loginResult;
  final AppFailure? loginFailure;

  @override
  Future<StudyUser> login({required String email, required String password}) async {
    if (loginFailure case final failure?) throw failure;
    return loginResult!;
  }

  @override
  Future<StudyUser?> restoreSession() async => null;

  @override
  Future<StudyUser> currentUser() async => loginResult!;

  @override
  Future<StudyUser> register({
    required String fullName,
    required String email,
    required String password,
    String? universityId,
  }) async => loginResult!;

  @override
  Future<void> logout() async {}

  @override
  Future<List<UniversityOption>> universities() async => const [];
}

void main() {
  const user = StudyUser(id: '1', email: 'lea@example.test', role: 'USER');

  blocTest<AuthCubit, AuthState>(
    'emits submitting and authenticated on successful login',
    build: () => AuthCubit(_Repository(loginResult: user)),
    act: (cubit) => cubit.login(email: user.email, password: 'Secret123!'),
    expect: () => [
      isA<AuthState>().having((state) => state.status, 'status', AuthStatus.submitting),
      isA<AuthState>()
          .having((state) => state.status, 'status', AuthStatus.authenticated)
          .having((state) => state.user?.id, 'user id', user.id)
          .having((state) => state.successMessage, 'success', 'Connexion réussie.'),
    ],
  );

  blocTest<AuthCubit, AuthState>(
    'emits a typed error after failed login',
    build: () => AuthCubit(_Repository(
      loginFailure: const AppFailure(
        kind: FailureKind.unauthenticated,
        message: 'Identifiants incorrects',
      ),
    )),
    act: (cubit) => cubit.login(email: user.email, password: 'bad'),
    expect: () => [
      isA<AuthState>().having((state) => state.status, 'status', AuthStatus.submitting),
      isA<AuthState>()
          .having((state) => state.status, 'status', AuthStatus.unauthenticated)
          .having((state) => state.failure?.kind, 'failure kind', FailureKind.unauthenticated)
          .having((state) => state.failure?.message, 'failure message', 'Identifiants incorrects'),
    ],
  );
}
