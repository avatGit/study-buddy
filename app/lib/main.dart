import 'package:material_ui/material_ui.dart';
import 'package:flutter_bloc/flutter_bloc.dart';

import 'core/api/auth_api_client.dart';
import 'core/session/secure_token_store.dart';
import 'features/auth/data/auth_repository.dart';
import 'features/auth/presentation/auth_cubit.dart';
import 'features/auth/presentation/auth_page.dart';
import 'features/home/presentation/main_shell.dart';

void main() {
  const apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://localhost:3000',
  );
  final client = AuthApiClient(
    baseUrl: apiBaseUrl,
    tokenStore: SecureTokenStore(),
  );
  final authCubit = AuthCubit(AuthRepository(client))..restoreSession();
  runApp(StudyBuddyApp(authCubit: authCubit));
}

class StudyBuddyApp extends StatelessWidget {
  const StudyBuddyApp({required this.authCubit, super.key});

  final AuthCubit authCubit;

  @override
  Widget build(BuildContext context) {
    return BlocProvider.value(
      value: authCubit,
      child: MaterialApp(
        title: 'StudyBuddy',
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF173B57)),
          useMaterial3: true,
        ),
        home: const _AppGate(),
      ),
    );
  }
}

class _AppGate extends StatelessWidget {
  const _AppGate();

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<AuthCubit, AuthState>(
      builder: (context, state) => switch (state.status) {
        AuthStatus.restoring => const Scaffold(
          body: Center(child: CircularProgressIndicator()),
        ),
        AuthStatus.signedOut => const AuthPage(),
        AuthStatus.signedIn => const MainShell(),
      },
    );
  }
}
