import 'package:material_ui/material_ui.dart';

class AppButton extends StatelessWidget {
  const AppButton({
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.secondary = false,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final bool secondary;

  @override
  Widget build(BuildContext context) {
    final child = loading
        ? const SizedBox.square(
            dimension: 20,
            child: CircularProgressIndicator(strokeWidth: 2),
          )
        : Text(label);
    if (secondary) {
      return OutlinedButton(
        onPressed: loading ? null : onPressed,
        child: child,
      );
    }
    return FilledButton(onPressed: loading ? null : onPressed, child: child);
  }
}
