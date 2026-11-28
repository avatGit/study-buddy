import 'package:material_ui/material_ui.dart';

import '../../core/theme/app_spacing.dart';
import 'app_button.dart';

class LoadingView extends StatelessWidget {
  const LoadingView({this.label, super.key});
  final String? label;

  @override
  Widget build(BuildContext context) => Center(
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const CircularProgressIndicator(),
        if (label case final text?) ...[
          const SizedBox(height: AppSpacing.md),
          Text(text),
        ],
      ],
    ),
  );
}

class ErrorView extends StatelessWidget {
  const ErrorView({required this.message, required this.onRetry, super.key});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(AppSpacing.pageMargin),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: AppSpacing.lg),
          AppButton(label: 'Réessayer', onPressed: onRetry, secondary: true),
        ],
      ),
    ),
  );
}

class EmptyView extends StatelessWidget {
  const EmptyView({required this.message, super.key});
  final String message;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(AppSpacing.pageMargin),
      child: Text(message, textAlign: TextAlign.center),
    ),
  );
}

void showSuccessMessage(BuildContext context, String message) {
  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
}
