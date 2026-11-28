class AuthFormValidators {
  static String? required(String? value) =>
      value == null || value.trim().isEmpty ? 'Ce champ est obligatoire.' : null;

  static String? email(String? value) {
    final text = value?.trim() ?? '';
    if (text.isEmpty) return 'Ce champ est obligatoire.';
    final valid = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$').hasMatch(text);
    return valid ? null : 'Saisis une adresse e-mail valide.';
  }

  static String? password(String? value) {
    if (value == null || value.isEmpty) return 'Ce champ est obligatoire.';
    if (value.length < 8) return 'Le mot de passe doit contenir au moins 8 caractères.';
    if (value.length > 128) return 'Le mot de passe ne peut pas dépasser 128 caractères.';
    return null;
  }
}
