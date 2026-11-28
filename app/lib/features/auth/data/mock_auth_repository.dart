import 'dart:async';

import '../../../core/errors/app_failure.dart';
import '../domain/auth_repository.dart';
import '../domain/study_user.dart';

class MockAuthRepository implements AuthRepository {
  MockAuthRepository({this.delay = const Duration(milliseconds: 350)});

  final Duration delay;
  StudyUser? _current;
  final Map<String, StudyUser> _accounts = {};

  @override
  Future<StudyUser?> restoreSession() async {
    await Future<void>.delayed(delay);
    return _current;
  }

  @override
  Future<StudyUser> currentUser() async {
    await Future<void>.delayed(delay);
    if (_current == null) {
      throw const AppFailure(
        kind: FailureKind.unauthenticated,
        message: 'Connecte-toi pour continuer.',
      );
    }
    return _current!;
  }

  @override
  Future<StudyUser> login({required String email, required String password}) async {
    await Future<void>.delayed(delay);
    final account = _accounts[email.trim().toLowerCase()];
    if (account == null || password != 'StudyBuddy123!') {
      throw const AppFailure(
        kind: FailureKind.unauthenticated,
        message: 'Adresse e-mail ou mot de passe incorrect.',
        statusCode: 401,
        code: 'UNAUTHENTICATED',
      );
    }
    _current = account;
    return account;
  }

  @override
  Future<StudyUser> register({
    required String fullName,
    required String email,
    required String password,
    String? universityId,
  }) async {
    await Future<void>.delayed(delay);
    final normalizedEmail = email.trim().toLowerCase();
    if (_accounts.containsKey(normalizedEmail)) {
      throw const AppFailure(
        kind: FailureKind.conflict,
        message: 'Un compte existe déjà avec cette adresse e-mail.',
        statusCode: 409,
        code: 'CONFLICT',
      );
    }
    final user = StudyUser(
      id: 'mock-${_accounts.length + 1}',
      fullName: fullName.trim(),
      email: normalizedEmail,
      role: 'USER',
      universityId: universityId,
    );
    _accounts[normalizedEmail] = user;
    _current = user;
    return user;
  }

  @override
  Future<void> logout() async {
    await Future<void>.delayed(delay);
    _current = null;
  }

  @override
  Future<List<UniversityOption>> universities() async {
    await Future<void>.delayed(delay);
    return const [
      UniversityOption(id: 'university-demo', name: 'Université de démonstration'),
    ];
  }
}
