import '../../../core/config/app_config.dart';
import '../../../core/network/api_client.dart';
import '../../../core/storage/secure_token_store.dart';
import '../../../core/storage/session_tokens.dart';
import '../domain/auth_repository.dart';
import 'api_auth_repository.dart';
import 'mock_auth_repository.dart';

class AuthDependencies {
  AuthDependencies._({required this.repository, this.tokens});

  final AuthRepository repository;
  final SessionTokens? tokens;

  static AuthDependencies create({bool? useMock}) {
    if (useMock ?? AppConfig.useMockAuth) {
      return AuthDependencies._(repository: MockAuthRepository());
    }
    final tokens = SessionTokens(SecureTokenStore());
    final client = ApiClient(tokens: tokens);
    return AuthDependencies._(
      repository: ApiAuthRepository(client: client, tokens: tokens),
      tokens: tokens,
    );
  }
}
