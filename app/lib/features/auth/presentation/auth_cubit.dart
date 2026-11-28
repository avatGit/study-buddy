import 'package:flutter_bloc/flutter_bloc.dart';

import '../data/auth_models.dart';
import '../data/auth_repository.dart';

enum AuthStatus { restoring, signedOut, signedIn }

class AuthState {
  const AuthState({required this.status, this.user});

  final AuthStatus status;
  final AuthUser? user;
}

class AuthCubit extends Cubit<AuthState> {
  AuthCubit(this.repository)
    : super(const AuthState(status: AuthStatus.restoring)) {
    repository.client.onSessionExpired = _sessionExpired;
  }

  final AuthRepository repository;

  Future<void> restoreSession() async {
    final session = await repository.restoreSession();
    if (isClosed) return;
    if (session == null) {
      _markSignedOut();
    } else {
      emit(AuthState(status: AuthStatus.signedIn, user: session.user));
    }
  }

  Future<void> login(String email, String password) async {
    final user = await repository.login(email, password);
    emit(AuthState(status: AuthStatus.signedIn, user: user));
  }

  Future<void> register({
    required String fullName,
    required String email,
    required String password,
    String? universityId,
  }) async {
    final user = await repository.register(
      fullName: fullName,
      email: email,
      password: password,
      universityId: universityId,
    );
    emit(AuthState(status: AuthStatus.signedIn, user: user));
  }

  Future<List<UniversityOption>> loadUniversities() =>
      repository.loadUniversities();

  Future<void> reloadCurrentUser() async {
    final user = await repository.reloadCurrentUser();
    emit(AuthState(status: AuthStatus.signedIn, user: user));
  }

  Future<void> logout() async {
    await repository.logout();
    _markSignedOut();
  }

  void _sessionExpired() {
    _markSignedOut();
  }

  void _markSignedOut() {
    if (!isClosed && state.status != AuthStatus.signedOut) {
      emit(const AuthState(status: AuthStatus.signedOut));
    }
  }

  @override
  Future<void> close() {
    repository.client.onSessionExpired = null;
    return super.close();
  }
}
