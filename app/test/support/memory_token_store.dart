import 'package:studybuddy_app/core/session/secure_token_store.dart';

class MemoryTokenStore implements TokenStore {
  StoredTokens? tokens;

  @override
  Future<void> clear() async {
    tokens = null;
  }

  @override
  Future<StoredTokens?> read() async => tokens;

  @override
  Future<void> write(StoredTokens value) async {
    tokens = value;
  }
}
