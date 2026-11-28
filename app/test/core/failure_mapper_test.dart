import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:studybuddy_app/core/errors/app_failure.dart';
import 'package:studybuddy_app/core/errors/failure_mapper.dart';

void main() {
  test('maps validation details to field errors', () {
    final failure = mapDioFailure(
      DioException(
        requestOptions: RequestOptions(path: '/api/auth/register'),
        response: Response<Object?>(
          requestOptions: RequestOptions(path: '/api/auth/register'),
          statusCode: 422,
          data: {
            'error': {
              'code': 'VALIDATION_ERROR',
              'message': 'Invalid fields',
              'details': [
                {'path': 'email', 'message': 'Invalid email'},
              ],
            },
          },
        ),
      ),
    );
    expect(failure.kind, FailureKind.validation);
    expect(failure.fieldErrors['email'], 'Invalid email');
    expect(failure.message, 'Vérifie les champs indiqués.');
  });

  test('maps unavailable connections and timeouts', () {
    final timeout = mapDioFailure(
      DioException(
        requestOptions: RequestOptions(path: '/test'),
        type: DioExceptionType.receiveTimeout,
      ),
    );
    final network = mapDioFailure(
      DioException(
        requestOptions: RequestOptions(path: '/test'),
        type: DioExceptionType.connectionError,
      ),
    );
    expect(timeout.kind, FailureKind.timeout);
    expect(network.kind, FailureKind.network);
  });
}
