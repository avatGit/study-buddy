class StudyUser {
  const StudyUser({
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
}

class UniversityOption {
  const UniversityOption({required this.id, required this.name});

  final String id;
  final String name;
}
