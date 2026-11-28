import 'package:flutter_test/flutter_test.dart';
import 'package:studybuddy_app/features/auth/data/auth_repository_provider.dart';
import 'package:studybuddy_app/study_buddy_app.dart';

void main() {
  testWidgets('renders the clean StudyBuddy shell', (tester) async {
    await tester.pumpWidget(
      StudyBuddyApp(dependencies: AuthDependencies.create(useMock: true)),
    );
    await tester.pumpAndSettle();
    expect(find.text('StudyBuddy'), findsOneWidget);
  });
}
