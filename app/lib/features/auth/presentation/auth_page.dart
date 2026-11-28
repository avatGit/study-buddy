import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:material_ui/material_ui.dart';

import '../../../core/errors/app_failure.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/theme/app_spacing.dart';
import '../../../core/theme/app_typography.dart';
import '../../../shared/widgets/app_button.dart';
import '../../../shared/widgets/app_text_field.dart';
import '../../../shared/widgets/app_states.dart';
import '../domain/study_user.dart';
import 'auth_cubit.dart';
import 'auth_form_validators.dart';
import 'auth_state.dart';

enum _AuthMode { signIn, signUp }

class AuthPage extends StatefulWidget {
  const AuthPage({super.key});

  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  final _formKey = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  _AuthMode _mode = _AuthMode.signIn;
  String? _universityId;
  bool _showPassword = false;
  Future<List<UniversityOption>>? _universities;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _universities ??= context.read<AuthCubit>().universities();
  }

  @override
  void dispose() {
    _name.dispose();
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;
    final cubit = context.read<AuthCubit>();
    if (_mode == _AuthMode.signIn) {
      cubit.login(email: _email.text.trim(), password: _password.text);
    } else {
      cubit.register(
        fullName: _name.text.trim(),
        email: _email.text.trim(),
        password: _password.text,
        universityId: _universityId,
      );
    }
  }

  @override
  Widget build(BuildContext context) => BlocListener<AuthCubit, AuthState>(
        listenWhen: (previous, current) => current.successMessage != null,
        listener: (context, state) => showSuccessMessage(context, state.successMessage!),
        child: Scaffold(
          body: SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) => SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.pageMargin,
                  AppSpacing.lg,
                  AppSpacing.pageMargin,
                  AppSpacing.lg,
                ),
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: constraints.maxHeight - AppSpacing.xl),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      _buildBrand(),
                      if (_mode == _AuthMode.signIn) ...[
                        const SizedBox(height: AppSpacing.lg),
                        _buildWelcomeCard(),
                        const SizedBox(height: AppSpacing.md),
                        _buildBenefitRow(),
                      ],
                      const SizedBox(height: AppSpacing.lg),
                      _buildFormCard(context),
                      const SizedBox(height: AppSpacing.section),
                      _buildFooter(context),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      );

  Widget _buildBrand() => Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.primary,
              borderRadius: BorderRadius.circular(AppRadii.md),
            ),
            child: const Icon(Icons.school_outlined, color: AppColors.onPrimary, size: 21),
          ),
          const SizedBox(width: AppSpacing.sm),
          const Text('StudyBuddy', style: AppTypography.titleLarge),
          const Spacer(),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.xs),
            decoration: BoxDecoration(
              color: AppColors.surfaceContainerLow,
              borderRadius: BorderRadius.circular(AppRadii.full),
              border: Border.all(color: AppColors.outlineVariant),
            ),
            child: const Text('Tutorat étudiant', style: AppTypography.bodySmall),
          ),
        ],
      );

  Widget _buildWelcomeCard() => Container(
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [AppColors.primaryContainer, AppColors.inverseSurface],
          ),
          borderRadius: BorderRadius.circular(AppRadii.xl),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Apprends ensemble, à ton rythme.',
              style: AppTypography.headlineMedium.copyWith(color: Colors.white),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Un compte pour demander de l’aide ou proposer du tutorat.',
              style: AppTypography.bodySmall.copyWith(color: Colors.white),
            ),
          ],
        ),
      );

  Widget _buildBenefitRow() => const Row(
        children: [
          Expanded(child: _Benefit(icon: Icons.people_outline, label: 'Tuteurs actifs')),
          SizedBox(width: AppSpacing.sm),
          Expanded(child: _Benefit(icon: Icons.swap_horiz, label: 'Apprendre ensemble')),
          SizedBox(width: AppSpacing.sm),
          Expanded(child: _Benefit(icon: Icons.event_available, label: 'Réservation simple')),
        ],
      );

  Widget _buildFormCard(BuildContext context) => Container(
        padding: const EdgeInsets.all(AppSpacing.lg),
        decoration: BoxDecoration(
          color: AppColors.surfaceContainerLowest,
          borderRadius: BorderRadius.circular(AppRadii.xl),
          border: Border.all(color: AppColors.outlineVariant),
        ),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Builder(builder: (context) {
                final fieldErrors = context.select<AuthCubit, Map<String, String>>(
                  (cubit) => cubit.state.fieldErrors,
                );
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
              _buildModeSelector(),
              const SizedBox(height: AppSpacing.lg),
              BlocBuilder<AuthCubit, AuthState>(
                buildWhen: (previous, current) => previous.failure != current.failure,
                builder: (context, state) => state.failure == null
                    ? const SizedBox.shrink()
                    : _ErrorBanner(failure: state.failure!),
              ),
              if (_mode == _AuthMode.signUp) ...[
                AppTextField(
                  controller: _name,
                  label: 'Nom complet',
                  errorText: fieldErrors['fullName'],
                  textInputAction: TextInputAction.next,
                  validator: AuthFormValidators.fullName,
                ),
                const SizedBox(height: AppSpacing.md),
              ],
              AppTextField(
                controller: _email,
                label: 'Adresse e-mail',
                errorText: fieldErrors['email'],
                keyboardType: TextInputType.emailAddress,
                textInputAction: TextInputAction.next,
                validator: AuthFormValidators.email,
                prefixIcon: const Icon(Icons.mail_outline),
              ),
              if (_mode == _AuthMode.signUp) ...[
                const SizedBox(height: AppSpacing.md),
                _buildUniversityField(),
              ],
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  Expanded(
                    child: AppTextField(
                      controller: _password,
                      label: _mode == _AuthMode.signIn ? 'Mot de passe' : 'Créer un mot de passe',
                      errorText: fieldErrors['password'],
                      obscureText: !_showPassword,
                      textInputAction: TextInputAction.done,
                      validator: AuthFormValidators.password,
                      prefixIcon: const Icon(Icons.lock_outline),
                      suffix: IconButton(
                        tooltip: _showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe',
                        onPressed: () => setState(() => _showPassword = !_showPassword),
                        icon: Icon(_showPassword ? Icons.visibility_off : Icons.visibility),
                      ),
                    ),
                  ),
                ],
              ),
              if (_mode == _AuthMode.signIn)
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: () => ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('La récupération du mot de passe sera bientôt disponible.')),
                    ),
                    child: const Text('Mot de passe oublié ?'),
                  ),
                )
              else
                const Padding(
                  padding: EdgeInsets.only(top: AppSpacing.xs),
                  child: Text(
                    'Minimum 8 caractères. Ton université est facultative et déclarative.',
                    style: AppTypography.bodySmall,
                  ),
                ),
              const SizedBox(height: AppSpacing.md),
              BlocBuilder<AuthCubit, AuthState>(
                buildWhen: (previous, current) => previous.status != current.status,
                builder: (context, state) => AppButton(
                  label: _mode == _AuthMode.signIn ? 'Se connecter' : 'Créer mon compte apprenant',
                  loading: state.status == AuthStatus.submitting,
                  onPressed: state.status == AuthStatus.submitting ? null : _submit,
                ),
              ),
            ],
                );
              }),
          ],
        ),
        ),
      );

  Widget _buildModeSelector() => SegmentedButton<_AuthMode>(
        segments: const [
          ButtonSegment(value: _AuthMode.signIn, label: Text('Connexion')),
          ButtonSegment(value: _AuthMode.signUp, label: Text('Créer un compte')),
        ],
        selected: {_mode},
        onSelectionChanged: (selection) => setState(() => _mode = selection.first),
        showSelectedIcon: false,
      );

  Widget _buildUniversityField() => FutureBuilder<List<UniversityOption>>(
        future: _universities,
        builder: (context, snapshot) {
          final items = snapshot.data ?? const <UniversityOption>[];
          const decoration = InputDecoration(
            labelText: 'Université (facultatif)',
            helperText: 'Déclarée par toi, non vérifiée.',
          );
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const InputDecorator(
              decoration: decoration,
              child: Row(
                children: [
                  SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                  SizedBox(width: AppSpacing.md),
                  Text('Chargement des universités…', style: AppTypography.bodyMedium),
                ],
              ),
            );
          }
          if (snapshot.hasError) {
            return InputDecorator(
              decoration: decoration.copyWith(errorText: 'Impossible de charger la liste.'),
              child: Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () => setState(() {
                    _universities = context.read<AuthCubit>().universities();
                  }),
                  icon: const Icon(Icons.refresh),
                  label: const Text('Réessayer'),
                ),
              ),
            );
          }
          return DropdownButtonFormField<String>(
            initialValue: _universityId,
            decoration: decoration.copyWith(
              helperText: items.isEmpty ? 'Aucune université disponible' : 'Déclarée par toi, non vérifiée.',
            ),
            hint: Text(items.isEmpty ? 'Aucune université disponible' : 'Choisir une université'),
            items: [
              const DropdownMenuItem<String>(value: null, child: Text('Aucune université')),
              ...items.map((option) => DropdownMenuItem(
                    value: option.id,
                    child: Text(option.name, overflow: TextOverflow.ellipsis),
                  )),
            ],
            onChanged: snapshot.hasError
                ? null
                : (value) => setState(() => _universityId = value),
          );
        },
      );

  Widget _buildFooter(BuildContext context) => Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            _mode == _AuthMode.signIn ? 'Pas encore de compte ?' : 'Tu as déjà un compte ?',
            style: AppTypography.bodySmall,
          ),
          TextButton(
            onPressed: () => setState(() {
              _mode = _mode == _AuthMode.signIn ? _AuthMode.signUp : _AuthMode.signIn;
            }),
            child: Text(_mode == _AuthMode.signIn ? 'Créer un compte' : 'Se connecter'),
          ),
        ],
      );
}

class _Benefit extends StatelessWidget {
  const _Benefit({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(AppSpacing.sm),
        decoration: BoxDecoration(
          color: AppColors.surfaceContainerLow,
          border: Border.all(color: AppColors.outlineVariant),
          borderRadius: BorderRadius.circular(AppRadii.md),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, size: 18, color: AppColors.primary),
            const SizedBox(height: AppSpacing.xs),
            Text(label, style: AppTypography.labelLarge, maxLines: 2),
          ],
        ),
      );
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.failure});
  final AppFailure failure;

  @override
  Widget build(BuildContext context) => Container(
        margin: const EdgeInsets.only(bottom: AppSpacing.lg),
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: AppColors.errorContainer,
          borderRadius: BorderRadius.circular(AppRadii.md),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.error_outline, color: AppColors.onErrorContainer),
            const SizedBox(width: AppSpacing.sm),
            Expanded(child: Text(failure.message, style: AppTypography.bodyMedium)),
          ],
        ),
      );
}
