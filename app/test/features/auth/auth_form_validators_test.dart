import 'package:flutter_test/flutter_test.dart';
import 'package:studybuddy_app/features/auth/presentation/auth_form_validators.dart';

void main() {
  test('validates required names and email format', () {
    expect(AuthFormValidators.required('  '), isNotNull);
    expect(AuthFormValidators.required('Aïcha Diallo'), isNull);
    expect(AuthFormValidators.email('student.example.test'), isNotNull);
    expect(AuthFormValidators.email('student@example.test'), isNull);
  });

  test('matches the API password length constraints', () {
    expect(AuthFormValidators.password('short'), isNotNull);
    expect(AuthFormValidators.password('valid-pass-123'), isNull);
    expect(AuthFormValidators.password('x' * 129), isNotNull);
  });
}
