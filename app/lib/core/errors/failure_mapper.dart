import 'package:dio/dio.dart';

import 'app_failure.dart';

AppFailure mapDioFailure(DioException exception) {
  if (exception.type == DioExceptionType.connectionTimeout ||
      exception.type == DioExceptionType.sendTimeout ||
      exception.type == DioExceptionType.receiveTimeout) {
    return const AppFailure(
      kind: FailureKind.timeout,
      message: 'Le délai de réponse est dépassé. Réessaie.',
    );
  }
  if (exception.type == DioExceptionType.connectionError ||
      exception.type == DioExceptionType.badCertificate) {
    return const AppFailure(
      kind: FailureKind.network,
      message: 'Connexion impossible. Vérifie ton réseau puis réessaie.',
    );
  }

  final response = exception.response;
  if (response == null) {
    return const AppFailure(
      kind: FailureKind.network,
      message: 'Une erreur réseau est survenue. Réessaie.',
    );
  }
  final body = response.data;
  final rawError = body is Map ? body['error'] : null;
  final envelope = rawError is Map ? rawError : const <Object?, Object?>{};
  final code = envelope['code']?.toString();
  final serverMessage = envelope['message']?.toString();
  final status = response.statusCode;
  final details = envelope['details'];
  final fields = <String, String>{};
  if (details is List) {
    for (final detail in details) {
      if (detail is Map && detail['path'] != null && detail['message'] != null) {
        fields[detail['path'].toString()] = detail['message'].toString();
      }
    }
  }

  final kind = switch (code) {
    'UNAUTHENTICATED' => FailureKind.unauthenticated,
    'FORBIDDEN' => FailureKind.forbidden,
    'NOT_FOUND' => FailureKind.notFound,
    'CONFLICT' => FailureKind.conflict,
    'VALIDATION_ERROR' => FailureKind.validation,
    'RATE_LIMITED' => FailureKind.rateLimited,
    'PAYLOAD_TOO_LARGE' => FailureKind.payloadTooLarge,
    _ when status != null && status >= 500 => FailureKind.server,
    _ => FailureKind.unknown,
  };
  final message = switch (kind) {
    FailureKind.unauthenticated => 'Adresse e-mail ou mot de passe incorrect.',
    FailureKind.forbidden => 'Tu n’as pas accès à cette action.',
    FailureKind.notFound => 'Cette information est introuvable.',
    FailureKind.conflict => 'Cette action est en conflit avec ton compte.',
    FailureKind.validation => 'Vérifie les champs indiqués.',
    FailureKind.rateLimited => 'Trop de tentatives. Réessaie un peu plus tard.',
    FailureKind.payloadTooLarge => 'Les données envoyées sont trop volumineuses.',
    FailureKind.server => 'Le service rencontre un problème. Réessaie plus tard.',
    _ => serverMessage ?? 'Une erreur est survenue. Réessaie.',
  };
  return AppFailure(
    kind: kind,
    message: message,
    fieldErrors: fields,
    statusCode: status,
    code: code,
  );
}
