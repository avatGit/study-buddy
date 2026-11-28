import 'package:flutter_test/flutter_test.dart';
import 'package:studybuddy_app/core/errors/app_failure.dart';
import 'package:studybuddy_app/features/auth/data/mock_auth_repository.dart';

void main() {
  const universityId = '670000000000000000000001';
  final repository = MockAuthRepository(delay: Duration.zero);

  test(
    'validates and stores the same registration fields as the API',
    () async {
      final errors = await _captureFailure(
        () => repository.register(
          fullName: '  ${'A' * 121}  ',
          email: 'bad-email',
          password: 'short',
          universityId: 'not-an-object-id',
        ),
      );
      expect(errors.kind, FailureKind.validation);
      expect(errors.statusCode, 422);
      expect(
        errors.fieldErrors.keys,
        containsAll(['fullName', 'email', 'password', 'universityId']),
      );

      final user = await repository.register(
        fullName: '  Aïcha Diallo  ',
        email: ' AICHA@example.test ',
        password: 'A secure password 123',
        universityId: universityId,
      );
      expect(user.fullName, 'Aïcha Diallo');
      expect(user.email, 'aicha@example.test');
      expect(user.universityId, universityId);
      expect(user.role, 'USER');
    },
  );

  test(
    'returns API-shaped validation, conflict, and credential failures',
    () async {
      final duplicate = await _captureFailure(
        () => repository.register(
          fullName: 'Aïcha Diallo',
          email: 'aicha@example.test',
          password: 'A secure password 123',
          universityId: universityId,
        ),
      );
      expect(duplicate.kind, FailureKind.conflict);
      expect(duplicate.statusCode, 409);
      expect(duplicate.code, 'CONFLICT');
      expect(
        duplicate.fieldErrors['email'],
        'Un compte existe déjà avec cette adresse e-mail.',
      );

      final invalidLogin = await _captureFailure(
        () => repository.login(email: 'invalid', password: 'short'),
      );
      expect(invalidLogin.kind, FailureKind.validation);
      expect(invalidLogin.fieldErrors.keys, containsAll(['email', 'password']));

      final wrongPassword = await _captureFailure(
        () => repository.login(
          email: 'aicha@example.test',
          password: 'Wrong password 123',
        ),
      );
      expect(wrongPassword.kind, FailureKind.unauthenticated);
      expect(wrongPassword.statusCode, 401);
      expect(wrongPassword.code, 'UNAUTHENTICATED');

      final user = await repository.currentUser();
      expect(user.email, 'aicha@example.test');
      await repository.logout();
      expect(await repository.restoreSession(), isNull);
    },
  );
}

Future<AppFailure> _captureFailure(Future<Object?> Function() action) async {
  try {
    await action();
  } on AppFailure catch (failure) {
    return failure;
  }
  throw StateError('Expected AppFailure');
}
