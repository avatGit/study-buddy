import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class StoredTokens {
  const StoredTokens({required this.accessToken, required this.refreshToken});

  final String accessToken;
  final String refreshToken;

  factory StoredTokens.fromJson(Object? value) {
    if (value is! Map<String, dynamic> ||
        value['accessToken'] is! String ||
        value['refreshToken'] is! String) {
      throw const FormatException('Stored credentials are invalid.');
    }
    return StoredTokens(
      accessToken: value['accessToken'] as String,
      refreshToken: value['refreshToken'] as String,
    );
  }
}

abstract interface class TokenStore {
  Future<StoredTokens?> read();
  Future<void> write(StoredTokens tokens);
  Future<void> clear();
}

class SecureTokenStore implements TokenStore {
  SecureTokenStore({FlutterSecureStorage? storage})
    : _storage = storage ?? const FlutterSecureStorage();

  static const _credentialsKey = 'studybuddy.credentials';
  final FlutterSecureStorage _storage;

  @override
  Future<StoredTokens?> read() async {
    final value = await _storage.read(key: _credentialsKey);
    if (value == null) return null;
    return StoredTokens.fromJson(jsonDecode(value));
  }

  @override
  Future<void> write(StoredTokens tokens) => _storage.write(
    key: _credentialsKey,
    value: jsonEncode({
      'accessToken': tokens.accessToken,
      'refreshToken': tokens.refreshToken,
    }),
  );

  @override
  Future<void> clear() => _storage.delete(key: _credentialsKey);
}
