import 'dart:async';

import '../../../core/errors/app_failure.dart';
import '../domain/auth_repository.dart';
import '../domain/auth_input_validator.dart';
import '../domain/study_user.dart';

class MockAuthRepository implements AuthRepository {
  MockAuthRepository({
    this.delay = const Duration(milliseconds: 350),
    List<UniversityOption>? universityOptions,
  }) : _universities =
           universityOptions ??
           const [
             UniversityOption(
               id: '670000000000000000000001',
               name: 'Université de démonstration',
             ),
           ];

  final Duration delay;
  StudyUser? _current;
  final Map<String, _MockAccount> _accounts = {};
  final List<UniversityOption> _universities;

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
  Future<StudyUser> login({
    required String email,
    required String password,
  }) async {
    await Future<void>.delayed(delay);
    final errors = AuthInputValidator.validateLogin(
      email: email,
      password: password,
    );
    if (errors.isNotEmpty) throw validationFailure(errors);
    final account = _accounts[email.trim().toLowerCase()];
    if (account == null || account.password != password) {
      throw const AppFailure(
        kind: FailureKind.unauthenticated,
        message: 'Adresse e-mail ou mot de passe incorrect.',
        statusCode: 401,
        code: 'UNAUTHENTICATED',
      );
    }
    _current = account.user;
    return account.user;
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
    final normalizedUniversityId = universityId?.trim();
    final errors = AuthInputValidator.validateRegistration(
      fullName: fullName,
      email: email,
      password: password,
    );
    if (normalizedUniversityId != null &&
        !_universities.any(
          (university) =>
              university.id.toLowerCase() ==
              normalizedUniversityId.toLowerCase(),
        )) {
      errors['universityId'] = 'Choisis une université active.';
    }
    if (errors.isNotEmpty) throw validationFailure(errors);
    if (_accounts.containsKey(normalizedEmail)) {
      throw const AppFailure(
        kind: FailureKind.conflict,
        message: 'Un compte existe déjà avec cette adresse e-mail.',
        fieldErrors: {
          'email': 'Un compte existe déjà avec cette adresse e-mail.',
        },
        statusCode: 409,
        code: 'CONFLICT',
      );
    }
    final user = StudyUser(
      id: 'mock-${_accounts.length + 1}',
      fullName: fullName.trim(),
      email: normalizedEmail,
      role: 'USER',
      universityId: normalizedUniversityId,
    );
    _accounts[normalizedEmail] = _MockAccount(user, password);
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
    return List.unmodifiable(_universities);
  }
}

class _MockAccount {
  const _MockAccount(this.user, this.password);

  final StudyUser user;
  final String password;
}
