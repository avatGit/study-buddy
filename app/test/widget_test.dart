import 'package:flutter_test/flutter_test.dart';
import 'package:studybuddy_app/main.dart';

void main() {
  testWidgets('renders the clean StudyBuddy shell', (tester) async {
    await tester.pumpWidget(const StudyBuddyApp());
    expect(find.text('StudyBuddy'), findsOneWidget);
  });
}
