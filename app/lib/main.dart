import 'package:material_ui/material_ui.dart';

void main() {
  runApp(const StudyBuddyApp());
}

class StudyBuddyApp extends StatelessWidget {
  const StudyBuddyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'StudyBuddy',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF173B57)),
        useMaterial3: true,
      ),
      home: const Scaffold(body: Center(child: Text('StudyBuddy'))),
    );
  }
}
