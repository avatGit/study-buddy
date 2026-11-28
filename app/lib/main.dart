import 'package:material_ui/material_ui.dart';

import 'core/theme/app_theme.dart';

void main() {
  runApp(const StudyBuddyApp());
}

class StudyBuddyApp extends StatelessWidget {
  const StudyBuddyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'StudyBuddy',
      theme: AppTheme.light,
      home: const Scaffold(
        body: Center(child: Text('StudyBuddy')),
      ),
    );
  }
}
