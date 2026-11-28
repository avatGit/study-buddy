import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/data/auth_repository_provider.dart';
import 'features/auth/presentation/auth_cubit.dart';

class StudyBuddyApp extends StatefulWidget {
  const StudyBuddyApp({super.key, this.dependencies});

  final AuthDependencies? dependencies;

  @override
  State<StudyBuddyApp> createState() => _StudyBuddyAppState();
}

class _StudyBuddyAppState extends State<StudyBuddyApp> {
  late final AuthCubit _authCubit;
  late final AuthRouterRefresh _routerRefresh;
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    final dependencies = widget.dependencies ?? AuthDependencies.create();
    _authCubit = AuthCubit(dependencies.repository);
    _routerRefresh = AuthRouterRefresh(_authCubit);
    _router = createAppRouter(_authCubit, refreshListenable: _routerRefresh);
    _authCubit.restoreSession();
  }

  @override
  void dispose() {
    _router.dispose();
    _routerRefresh.dispose();
    _authCubit.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => BlocProvider.value(
        value: _authCubit,
        child: MaterialApp.router(
          title: 'StudyBuddy',
          theme: AppTheme.light,
          routerConfig: _router,
        ),
      );
}
