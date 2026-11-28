enum FailureKind {
  network,
  timeout,
  unauthenticated,
  forbidden,
  notFound,
  conflict,
  validation,
  rateLimited,
  payloadTooLarge,
  server,
  unknown,
}

class AppFailure implements Exception {
  const AppFailure({
    required this.kind,
    required this.message,
    this.fieldErrors = const {},
    this.statusCode,
    this.code,
  });

  final FailureKind kind;
  final String message;
  final Map<String, String> fieldErrors;
  final int? statusCode;
  final String? code;

  @override
  String toString() => message;
}
