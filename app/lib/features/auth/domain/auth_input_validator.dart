abstract final class AuthInputValidator {
  static String? fullName(String? value) {
    final name = value?.trim() ?? '';
    if (name.isEmpty) return 'Ce champ est obligatoire.';
    if (name.length > 120) return 'Le nom ne peut pas dépasser 120 caractères.';
    return null;
  }

  static String? email(String? value) {
    final address = value?.trim() ?? '';
    if (address.isEmpty) return 'Ce champ est obligatoire.';
    if (address.length > 254) return 'L’adresse e-mail ne peut pas dépasser 254 caractères.';
    return RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(address)
        ? null
        : 'Saisis une adresse e-mail valide.';
  }

  static String? password(String? value) {
    if (value == null || value.isEmpty) return 'Ce champ est obligatoire.';
    if (value.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
    if (value.length > 128) return 'Le mot de passe ne peut pas dépasser 128 caractères.';
    return null;
  }

  static Map<String, String> validateLogin({required String email, required String password}) => {
        'email': ?AuthInputValidator.email(email),
        'password': ?AuthInputValidator.password(password),
      };

  static Map<String, String> validateRegistration({
    required String fullName,
    required String email,
    required String password,
  }) => {
        'fullName': ?AuthInputValidator.fullName(fullName),
        'email': ?AuthInputValidator.email(email),
        'password': ?AuthInputValidator.password(password),
      };
}
