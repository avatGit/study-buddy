import 'package:dio/dio.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:material_ui/material_ui.dart';

import '../../auth/presentation/auth_cubit.dart';

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _selectedIndex = 0;

  @override
  Widget build(BuildContext context) {
    final user = context.select((AuthCubit cubit) => cubit.state.user);
    final destinations = const [
      NavigationDestination(icon: Icon(Icons.home_outlined), label: 'Home'),
      NavigationDestination(icon: Icon(Icons.search), label: 'Search'),
      NavigationDestination(
        icon: Icon(Icons.event_note_outlined),
        label: 'My Sessions',
      ),
      NavigationDestination(icon: Icon(Icons.person_outline), label: 'Profile'),
    ];

    return Scaffold(
      appBar: AppBar(title: Text(destinations[_selectedIndex].label)),
      body: IndexedStack(
        index: _selectedIndex,
        children: [
          Center(
            child: Text(
              'Welcome${user?.fullName == null ? '' : ', ${user!.fullName}'}',
            ),
          ),
          const Center(child: Text('Tutor search')),
          const Center(child: Text('My sessions')),
          const _ProfilePanel(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedIndex,
        destinations: destinations,
        onDestinationSelected: (index) =>
            setState(() => _selectedIndex = index),
      ),
    );
  }
}

class _ProfilePanel extends StatelessWidget {
  const _ProfilePanel();

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AuthCubit>().state;
    final user = state.user;
    if (user == null) return const SizedBox.shrink();

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: ListView(
          padding: const EdgeInsets.all(24),
          shrinkWrap: true,
          children: [
            Text(user.fullName ?? 'Name not provided'),
            const SizedBox(height: 8),
            Text(user.email),
            const SizedBox(height: 8),
            Text(
              user.universityId == null
                  ? 'No university selected'
                  : 'University selected',
            ),
            const SizedBox(height: 20),
            OutlinedButton(
              key: const Key('reloadProfileButton'),
              onPressed: () => _reload(context),
              child: const Text('Reload profile'),
            ),
            FilledButton.tonal(
              key: const Key('logoutButton'),
              onPressed: () => context.read<AuthCubit>().logout(),
              child: const Text('Sign out'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _reload(BuildContext context) async {
    try {
      await context.read<AuthCubit>().reloadCurrentUser();
    } on DioException {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Unable to reload your profile.')),
        );
      }
    } on FormatException {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Unable to reload your profile.')),
        );
      }
    }
  }
}
