import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:dio/dio.dart';

import '../../../core/errors/app_failure.dart';
import '../../../core/errors/failure_mapper.dart';
import '../domain/auth_repository.dart';
import '../domain/study_user.dart';
import 'auth_state.dart';

class AuthCubit extends Cubit<AuthState> {
  AuthCubit(this._repository) : super(const AuthState.restoring());

  final AuthRepository _repository;

  Future<List<UniversityOption>> universities() => _repository.universities();

  Future<void> restoreSession() async {
    emit(const AuthState.restoring());
    try {
      final user = await _repository.restoreSession();
      emit(user == null
          ? const AuthState.unauthenticated()
          : AuthState(status: AuthStatus.authenticated, user: user));
    } catch (_) {
      emit(const AuthState.unauthenticated());
    }
  }

  Future<void> login({required String email, required String password}) =>
      _authenticate(() => _repository.login(email: email, password: password), 'Connexion réussie.');

  Future<void> register({
    required String fullName,
    required String email,
    required String password,
    String? universityId,
  }) =>
      _authenticate(
        () => _repository.register(
          fullName: fullName,
          email: email,
          password: password,
          universityId: universityId,
        ),
        'Ton compte StudyBuddy est créé.',
      );

  Future<void> _authenticate(Future<StudyUser> Function() action, String success) async {
    emit(const AuthState(status: AuthStatus.submitting));
    try {
      final user = await action();
      emit(AuthState(
        status: AuthStatus.authenticated,
        user: user,
        successMessage: success,
      ));
    } on AppFailure catch (failure) {
      emit(AuthState(
        status: AuthStatus.unauthenticated,
        failure: failure,
      ));
    } on DioException catch (error) {
      emit(AuthState(
        status: AuthStatus.unauthenticated,
        failure: mapDioFailure(error),
      ));
    } catch (_) {
      emit(const AuthState(
        status: AuthStatus.unauthenticated,
        failure: AppFailure(
          kind: FailureKind.unknown,
          message: 'Une erreur est survenue. Réessaie.',
        ),
      ));
    }
  }

  Future<void> logout() async {
    try {
      await _repository.logout();
      emit(const AuthState.unauthenticated());
    } catch (_) {
      // L'implémentation API efface les jetons localement même si la requête échoue.
      emit(const AuthState.unauthenticated());
    }
  }
}
