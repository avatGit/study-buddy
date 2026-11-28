import 'package:dio/dio.dart';

import '../../../core/errors/failure_mapper.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_paths.dart';
import '../../../core/storage/session_tokens.dart';
import '../../../core/errors/app_failure.dart';
import '../domain/auth_repository.dart';
import '../domain/study_user.dart';
import 'auth_dto.dart';

class ApiAuthRepository implements AuthRepository {
  ApiAuthRepository({required ApiClient client, required SessionTokens tokens})
      : _client = client,
        _tokens = tokens;

  final ApiClient _client;
  final SessionTokens _tokens;

  @override
  Future<StudyUser?> restoreSession() async {
    final refreshToken = await _tokens.refreshToken;
    if (refreshToken == null || refreshToken.isEmpty) return null;
    if (_tokens.accessToken == null && !await _client.refreshSession()) return null;
    try {
      return await currentUser();
    } on AppFailure catch (failure) {
      if (failure.kind == FailureKind.unauthenticated) return null;
      rethrow;
    }
  }

  @override
  Future<StudyUser> currentUser() async {
    try {
      final response = await _client.dio.get<Object?>(ApiPaths.currentUser);
      final body = response.data;
      if (body is! Map || body['user'] is! Map) {
        throw const FormatException('Invalid current user response');
      }
      return StudyUserDto.fromJson(body['user'] as Map).toEntity();
    } on DioException catch (error) {
      throw mapDioFailure(error);
    }
  }

  @override
  Future<StudyUser> login({required String email, required String password}) async {
    try {
      final response = await _client.dio.post<Object?>(
        ApiPaths.login,
        data: {'email': email.trim(), 'password': password},
      );
      final dto = AuthDto.fromJson(response.data as Map);
      await _tokens.save(accessToken: dto.accessToken, refreshToken: dto.refreshToken);
      return dto.user;
    } on DioException catch (error) {
      throw mapDioFailure(error);
    }
  }

  @override
  Future<StudyUser> register({
    required String fullName,
    required String email,
    required String password,
    String? universityId,
  }) async {
    try {
      final data = <String, Object?>{
        'fullName': fullName.trim(),
        'email': email.trim(),
        'password': password,
        if (universityId != null && universityId.isNotEmpty) 'universityId': universityId,
      };
      final response = await _client.dio.post<Object?>(ApiPaths.register, data: data);
      final dto = AuthDto.fromJson(response.data as Map);
      await _tokens.save(accessToken: dto.accessToken, refreshToken: dto.refreshToken);
      return dto.user;
    } on DioException catch (error) {
      throw mapDioFailure(error);
    }
  }

  @override
  Future<void> logout() async {
    try {
      await _client.dio.post<void>(ApiPaths.logout);
    } on DioException catch (error) {
      throw mapDioFailure(error);
    } finally {
      await _tokens.clear();
    }
  }

  @override
  Future<List<UniversityOption>> universities() async {
    try {
      final response = await _client.dio.get<Object?>(ApiPaths.universities);
      final body = response.data;
      if (body is! Map || body['items'] is! List) {
        throw const FormatException('Invalid university list response');
      }
      return (body['items'] as List)
          .whereType<Map>()
          .map(UniversityDto.fromJson)
          .map((dto) => dto.toEntity())
          .toList(growable: false);
    } on DioException catch (error) {
      throw mapDioFailure(error);
    }
  }
}
