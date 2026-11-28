import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';
import 'package:studybuddy_app/features/auth/data/auth_repository_provider.dart';
import 'package:studybuddy_app/features/auth/domain/auth_repository.dart';
import 'package:studybuddy_app/features/auth/domain/study_user.dart';
import 'package:studybuddy_app/study_buddy_app.dart';

class _UniversityRepository implements AuthRepository {
  final requests = <Completer<List<UniversityOption>>>[];

  @override
  Future<List<UniversityOption>> universities() {
    final request = Completer<List<UniversityOption>>();
    requests.add(request);
    return request.future;
  }

  @override
  Future<StudyUser?> restoreSession() async => null;

  @override
  Future<StudyUser> currentUser() => throw UnimplementedError();

  @override
  Future<StudyUser> login({required String email, required String password}) =>
      throw UnimplementedError();

  @override
  Future<StudyUser> register({
    required String fullName,
    required String email,
    required String password,
    String? universityId,
  }) => throw UnimplementedError();

  @override
  Future<void> logout() async {}
}

Future<void> _openSignUp(
  WidgetTester tester,
  _UniversityRepository repository,
) async {
  await tester.pumpWidget(
    StudyBuddyApp(dependencies: AuthDependencies.withRepository(repository)),
  );
  await tester.pumpAndSettle();
  await tester.tap(find.text('Créer un compte').first);
  await tester.pump();
}

void main() {
  testWidgets('shows loading and empty university catalogue states', (
    tester,
  ) async {
    final repository = _UniversityRepository();
    await _openSignUp(tester, repository);

    expect(find.text('Chargement des universités…'), findsOneWidget);
    expect(repository.requests, hasLength(1));

    repository.requests.first.complete(const []);
    await tester.pumpAndSettle();

    expect(find.text('Aucune université disponible'), findsOneWidget);
    expect(find.text('Université (facultatif)'), findsOneWidget);
  });

  testWidgets('shows an error and retries loading universities', (
    tester,
  ) async {
    final repository = _UniversityRepository();
    await _openSignUp(tester, repository);
    repository.requests.first.completeError(StateError('offline'));
    await tester.pump();
    await tester.pump();

    expect(find.text('Impossible de charger la liste.'), findsOneWidget);
    expect(find.text('Réessayer'), findsOneWidget);
    await tester.tap(find.text('Réessayer'));
    await tester.pump();
    expect(repository.requests, hasLength(2));
    expect(find.text('Chargement des universités…'), findsOneWidget);

    repository.requests[1].complete(const [
      UniversityOption(
        id: '670000000000000000000001',
        name: 'Université de test',
      ),
    ]);
    await tester.pumpAndSettle();
    final dropdown = find.byType(DropdownButtonFormField<String>);
    expect(dropdown, findsOneWidget);
    await tester.ensureVisible(dropdown);
    await tester.tap(dropdown);
    await tester.pumpAndSettle();
    expect(find.text('Université de test'), findsOneWidget);
  });
}
