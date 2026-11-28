import 'package:flutter_test/flutter_test.dart';
import 'package:studybuddy_app/features/auth/data/api_auth_repository.dart';
import 'package:studybuddy_app/features/auth/data/auth_repository_provider.dart';
import 'package:studybuddy_app/features/auth/data/mock_auth_repository.dart';

void main() {
  test('selects the demo mock in one injection point', () {
    expect(AuthDependencies.create(useMock: true).repository, isA<MockAuthRepository>());
    expect(AuthDependencies.create(useMock: false).repository, isA<ApiAuthRepository>());
  });
}
