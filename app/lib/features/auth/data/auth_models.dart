class AuthUser {
  const AuthUser({
    required this.id,
    required this.fullName,
    required this.email,
    required this.role,
    required this.universityId,
  });

  final String id;
  final String? fullName;
  final String email;
  final String role;
  final String? universityId;

  factory AuthUser.fromJson(Object? value) {
    if (value is! Map<String, dynamic> ||
        value['id'] is! String ||
        (value['fullName'] != null && value['fullName'] is! String) ||
        value['email'] is! String ||
        value['role'] is! String ||
        (value['universityId'] != null && value['universityId'] is! String)) {
      throw const FormatException('The API returned an invalid user.');
    }
    return AuthUser(
      id: value['id'] as String,
      fullName: value['fullName'] as String?,
      email: value['email'] as String,
      role: value['role'] as String,
      universityId: value['universityId'] as String?,
    );
  }
}

class AuthSession {
  const AuthSession({
    required this.user,
    required this.accessToken,
    required this.refreshToken,
  });

  final AuthUser user;
  final String accessToken;
  final String refreshToken;

  factory AuthSession.fromJson(Object? value) {
    if (value is! Map<String, dynamic> ||
        value['accessToken'] is! String ||
        value['refreshToken'] is! String) {
      throw const FormatException('The API returned an invalid session.');
    }
    return AuthSession(
      user: AuthUser.fromJson(value['user']),
      accessToken: value['accessToken'] as String,
      refreshToken: value['refreshToken'] as String,
    );
  }
}

class UniversityOption {
  const UniversityOption({required this.id, required this.name});

  final String id;
  final String name;

  factory UniversityOption.fromJson(Object? value) {
    if (value is! Map<String, dynamic> ||
        value['id'] is! String ||
        value['name'] is! String) {
      throw const FormatException('The API returned an invalid university.');
    }
    return UniversityOption(
      id: value['id'] as String,
      name: value['name'] as String,
    );
  }
}
