import '../../../core/errors/app_failure.dart';
import 'study_user.dart';

abstract interface class AuthRepository {
  Future<StudyUser?> restoreSession();
  Future<StudyUser> currentUser();
  Future<StudyUser> login({required String email, required String password});
  Future<StudyUser> register({
    required String fullName,
    required String email,
    required String password,
    String? universityId,
  });
  Future<void> logout();
  Future<List<UniversityOption>> universities();
}

AppFailure validationFailure(Map<String, String> errors) => AppFailure(
  kind: FailureKind.validation,
  message: 'Vérifie les champs indiqués.',
  fieldErrors: errors,
  code: 'VALIDATION_ERROR',
  statusCode: 422,
);
