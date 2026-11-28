import '../domain/auth_input_validator.dart';

class AuthFormValidators {
  static String? required(String? value) =>
      value == null || value.trim().isEmpty
      ? 'Ce champ est obligatoire.'
      : null;

  static String? fullName(String? value) => AuthInputValidator.fullName(value);

  static String? email(String? value) => AuthInputValidator.email(value);

  static String? password(String? value) => AuthInputValidator.password(value);
}
