import '../domain/study_user.dart';

class AuthDto {
  const AuthDto({
    required this.user,
    required this.accessToken,
    required this.refreshToken,
  });

  final StudyUser user;
  final String accessToken;
  final String refreshToken;

  factory AuthDto.fromJson(Map<dynamic, dynamic> json) {
    final userJson = json['user'];
    if (userJson is! Map ||
        json['accessToken'] is! String ||
        json['refreshToken'] is! String) {
      throw const FormatException('Invalid authentication response');
    }
    return AuthDto(
      user: StudyUserDto.fromJson(userJson).toEntity(),
      accessToken: json['accessToken'] as String,
      refreshToken: json['refreshToken'] as String,
    );
  }
}

class StudyUserDto {
  const StudyUserDto({
    required this.id,
    required this.email,
    required this.role,
    this.fullName,
    this.universityId,
  });

  final String id;
  final String? fullName;
  final String email;
  final String role;
  final String? universityId;

  factory StudyUserDto.fromJson(Map<dynamic, dynamic> json) {
    if (json['id'] is! String ||
        json['email'] is! String ||
        json['role'] is! String) {
      throw const FormatException('Invalid user response');
    }
    return StudyUserDto(
      id: json['id'] as String,
      fullName: json['fullName'] as String?,
      email: json['email'] as String,
      role: json['role'] as String,
      universityId: json['universityId'] as String?,
    );
  }

  StudyUser toEntity() => StudyUser(
    id: id,
    fullName: fullName,
    email: email,
    role: role,
    universityId: universityId,
  );
}

class UniversityDto {
  const UniversityDto({required this.id, required this.name});

  factory UniversityDto.fromJson(Map<dynamic, dynamic> json) {
    if (json['id'] is! String || json['name'] is! String) {
      throw const FormatException('Invalid university response');
    }
    return UniversityDto(
      id: json['id'] as String,
      name: json['name'] as String,
    );
  }

  final String id;
  final String name;

  UniversityOption toEntity() => UniversityOption(id: id, name: name);
}
