import 'package:go_router/go_router.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/theme/app_spacing.dart';

class MainShell extends StatelessWidget {
  const MainShell({required this.navigationShell, super.key});

  final StatefulNavigationShell navigationShell;

  static const _destinations = [
    NavigationDestination(
      icon: Icon(Icons.home_outlined),
      selectedIcon: Icon(Icons.home),
      label: 'Accueil',
    ),
    NavigationDestination(icon: Icon(Icons.search), label: 'Rechercher'),
    NavigationDestination(
      icon: Icon(Icons.event_note_outlined),
      selectedIcon: Icon(Icons.event_note),
      label: 'Mes séances',
    ),
    NavigationDestination(
      icon: Icon(Icons.person_outline),
      selectedIcon: Icon(Icons.person),
      label: 'Profil',
    ),
  ];

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('StudyBuddy'),
      actions: [
        IconButton(
          tooltip: 'Notifications',
          onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Les notifications arrivent bientôt.'),
            ),
          ),
          icon: const Icon(Icons.notifications_none),
        ),
        const SizedBox(width: AppSpacing.xs),
      ],
    ),
    body: navigationShell,
    bottomNavigationBar: NavigationBar(
      selectedIndex: navigationShell.currentIndex,
      destinations: _destinations,
      onDestinationSelected: (index) => navigationShell.goBranch(
        index,
        initialLocation: index == navigationShell.currentIndex,
      ),
    ),
  );
}

class HomePlaceholder extends StatelessWidget {
  const HomePlaceholder({super.key});

  @override
  Widget build(BuildContext context) => const _PlaceholderPage(
    title: 'Bienvenue sur StudyBuddy',
    message: 'Ton espace étudiant sera bientôt disponible.',
  );
}

class SearchPlaceholder extends StatelessWidget {
  const SearchPlaceholder({super.key});

  @override
  Widget build(BuildContext context) => const _PlaceholderPage(
    title: 'Rechercher un tuteur',
    message: 'La recherche de tuteurs sera bientôt disponible.',
  );
}

class SessionsPlaceholder extends StatelessWidget {
  const SessionsPlaceholder({super.key});

  @override
  Widget build(BuildContext context) => const _PlaceholderPage(
    title: 'Mes séances',
    message: 'Tes demandes et séances apparaîtront ici.',
  );
}

class ProfilePlaceholder extends StatelessWidget {
  const ProfilePlaceholder({super.key});

  @override
  Widget build(BuildContext context) => const _PlaceholderPage(
    title: 'Profil',
    message: 'Les informations de ton compte apparaîtront ici.',
  );
}

class _PlaceholderPage extends StatelessWidget {
  const _PlaceholderPage({required this.title, required this.message});
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(AppSpacing.pageMargin),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(title, style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: AppSpacing.sm),
          Text(message, textAlign: TextAlign.center),
        ],
      ),
    ),
  );
}
