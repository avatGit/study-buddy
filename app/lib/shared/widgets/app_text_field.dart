import 'package:material_ui/material_ui.dart';

class AppTextField extends StatelessWidget {
  const AppTextField({
    required this.controller,
    required this.label,
    this.errorText,
    this.obscureText = false,
    this.keyboardType,
    this.textInputAction,
    this.prefixIcon,
    this.suffix,
    this.onChanged,
    this.validator,
    this.enabled = true,
    this.autovalidateMode,
    super.key,
  });

  final TextEditingController controller;
  final String label;
  final String? errorText;
  final bool obscureText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final Widget? prefixIcon;
  final Widget? suffix;
  final ValueChanged<String>? onChanged;
  final FormFieldValidator<String>? validator;
  final bool enabled;
  final AutovalidateMode? autovalidateMode;

  @override
  Widget build(BuildContext context) => TextFormField(
        controller: controller,
        obscureText: obscureText,
        keyboardType: keyboardType,
        textInputAction: textInputAction,
        onChanged: onChanged,
        validator: validator,
        enabled: enabled,
        autovalidateMode: autovalidateMode,
        decoration: InputDecoration(
          labelText: label,
          errorText: errorText,
          prefixIcon: prefixIcon,
          suffixIcon: suffix,
        ),
      );
}
