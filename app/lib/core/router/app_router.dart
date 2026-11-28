import 'dart:async';

import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../../features/auth/presentation/auth_cubit.dart';
import '../../../features/auth/presentation/auth_page.dart';
import '../../../features/auth/presentation/auth_state.dart';
import '../../../features/home/presentation/main_shell.dart';
import '../../../shared/widgets/app_states.dart';

String? authRedirect(AuthState auth, String location) {
  if (auth.status == AuthStatus.restoring) return location == '/' ? null : '/';
  if (auth.isAuthenticated) return location == '/' || location == '/auth' ? '/home' : null;
  return location == '/auth' ? null : '/auth';
}

class AuthRouterRefresh extends ChangeNotifier {
  AuthRouterRefresh(AuthCubit cubit) {
    _subscription = cubit.stream.listen((_) => notifyListeners());
  }

  late final StreamSubscription<AuthState> _subscription;

  @override
  void dispose() {
    _subscription.cancel();
    super.dispose();
  }
}

GoRouter createAppRouter(AuthCubit cubit, {AuthRouterRefresh? refreshListenable}) {
  final refresh = refreshListenable ?? AuthRouterRefresh(cubit);
  return GoRouter(
    initialLocation: '/',
    refreshListenable: refresh,
    redirect: (context, state) => authRedirect(cubit.state, state.matchedLocation),
    routes: [
      GoRoute(
        path: '/',
        builder: (context, state) => const Scaffold(body: LoadingView()),
      ),
      GoRoute(
        path: '/auth',
        builder: (context, state) => const AuthPage(),
      ),
      StatefulShellRoute.indexedStack(
        builder: (context, state, navigationShell) =>
            MainShell(navigationShell: navigationShell),
        branches: [
          StatefulShellBranch(routes: [
            GoRoute(path: '/home', builder: (context, state) => const HomePlaceholder()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/search', builder: (context, state) => const SearchPlaceholder()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/sessions', builder: (context, state) => const SessionsPlaceholder()),
          ]),
          StatefulShellBranch(routes: [
            GoRoute(path: '/profile', builder: (context, state) => const ProfilePlaceholder()),
          ]),
        ],
      ),
    ],
  );
}

