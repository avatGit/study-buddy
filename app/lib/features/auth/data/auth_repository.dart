import 'package:dio/dio.dart';

import '../../../core/api/auth_api_client.dart';
import 'auth_models.dart';

class AuthRepository {
  const AuthRepository(this.client);

  final AuthApiClient client;

  Future<AuthUser> login(String email, String password) async {
    final response = await client.post(
      '/api/auth/login',
      data: {'email': email, 'password': password},
    );
    final session = AuthSession.fromJson(response.data);
    await client.storeSession(session);
    return session.user;
  }

  Future<AuthUser> register({
    required String fullName,
    required String email,
    required String password,
    String? universityId,
  }) async {
    final response = await client.post(
      '/api/auth/register',
      data: {
        'fullName': fullName,
        'email': email,
        'password': password,
        ...?(universityId == null ? null : {'universityId': universityId}),
      },
    );
    final session = AuthSession.fromJson(response.data);
    await client.storeSession(session);
    return session.user;
  }

  Future<AuthSession?> restoreSession() => client.restoreSession();

  Future<AuthUser> reloadCurrentUser() async {
    final response = await client.get('/api/users/me');
    final body = response.data;
    if (body is! Map<String, dynamic>) {
      throw const FormatException('The API returned an invalid user response.');
    }
    return AuthUser.fromJson(body['user']);
  }

  Future<List<UniversityOption>> loadUniversities() async {
    final universities = <UniversityOption>[];
    var page = 1;
    var total = 0;
    do {
      final response = await client.get(
        '/api/universities',
        queryParameters: {'page': page, 'limit': 100},
      );
      final body = response.data;
      if (body is! Map<String, dynamic> ||
          body['items'] is! List<dynamic> ||
          body['total'] is! int) {
        throw const FormatException(
          'The API returned an invalid university list.',
        );
      }
      total = body['total'] as int;
      final items = (body['items'] as List<dynamic>)
          .map(UniversityOption.fromJson)
          .toList(growable: false);
      if (items.isEmpty && universities.length < total) {
        throw const FormatException(
          'The API returned an incomplete university list.',
        );
      }
      universities.addAll(items);
      page += 1;
    } while (universities.length < total);

    return List<UniversityOption>.unmodifiable(universities);
  }

  Future<void> logout() async {
    try {
      await client.post('/api/auth/logout');
    } on DioException {
      // Local logout still proceeds when the API cannot be reached.
    } finally {
      await client.clearSession();
    }
  }
}
