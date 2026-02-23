import {
    RiskAssessment,
    BaselineMetrics,
    RiskType,
    RiskLevel
} from '../../types-mfr';

/**
 * RISK DETECTION ENGINE - BiOss Executive BI
 * Senior implementation for high-scale B2B risk analysis.
 * 
 * This engine processes current performance data against normalized baselines
 * to detect early signs of churn (Lost Clients) and wallet-share leakage.
 */

/**
 * Calculates the core risk profile for a client based on physical volume and revenue.
 * 
 * @param currentVolume - Actual units/determinations processed in the current period.
 * @param currentRevenue - Actual revenue (ARS) generated in the current period.
 * @param baseline - Historical performance metrics (Phase 2: Baseline Alignment).
 * @param daysWithoutActivity - Counter of days since the last certified transaction.
 * @returns Partial RiskAssessment including type, level, drop delta, and economic impact.
 */
export const detectRiskProfile = (
    currentVolume: number,
    currentRevenue: number,
    baseline: BaselineMetrics,
    daysWithoutActivity: number
): Pick<RiskAssessment, 'tipo_riesgo' | 'nivel_riesgo' | 'porcentaje_caida' | 'impacto_economico'> => {

    // Phase 3.1: Delta Calculation (Volume-Based)
    // We prioritize volume over revenue to detect "Silent Churn" where high-value 
    // but low-volume tests might mask a general activity drop.
    const volPromedio = baseline.volumen_promedio_mensual;
    const porcentajeCaida = volPromedio > 0
        ? ((volPromedio - currentVolume) / volPromedio) * 100
        : 0;

    // Phase 3.2: Economic Impact Assessment
    // Calculates the theoretical revenue lost based on the volume drop and historical ASP (Average Selling Price).
    const volDrop = Math.max(0, volPromedio - currentVolume);
    const avgPrice = volPromedio > 0 ? (baseline.facturacion_promedio_mensual / volPromedio) : 0;
    const impactoEconomico = volDrop * avgPrice;

    // Phase 3.3: Automatic Classification (Adaptive Thresholds)
    let tipoRiesgo = RiskType.NORMAL;
    let nivelRiesgo = RiskLevel.BAJO;

    // Critical Logic: Priorities defined in PRD v2.0
    if (currentVolume === 0 && daysWithoutActivity >= 90) {
        // Fuga Total: No activity for a full quarter
        tipoRiesgo = RiskType.FUGA_TOTAL;
        nivelRiesgo = RiskLevel.ALTO;
    } else if (porcentajeCaida >= 95) {
        // Silencio Total: Statistical near-zero
        tipoRiesgo = RiskType.SILENCIO_TOTAL;
        nivelRiesgo = RiskLevel.ALTO;
    } else if (porcentajeCaida >= 40) {
        // Crítico: Delta exceeding the 40% survival threshold
        tipoRiesgo = RiskType.CRITICO;
        nivelRiesgo = RiskLevel.ALTO;
    } else if (porcentajeCaida >= 30) {
        // Riesgo: Significant drop requiring immediate CRM action
        tipoRiesgo = RiskType.RIESGO;
        nivelRiesgo = RiskLevel.MEDIO;
    } else if (porcentajeCaida >= 20) {
        // Alerta Temprana: Deviation detected, monitoring required
        tipoRiesgo = RiskType.ALERTA_TEMPRANA;
        nivelRiesgo = RiskLevel.BAJO;
    } else if (porcentajeCaida <= 0) {
        // Stable or Growth: Performance meets or exceeds baseline
        tipoRiesgo = RiskType.ESTABLE;
        nivelRiesgo = RiskLevel.BAJO;
    }

    return {
        tipo_riesgo: tipoRiesgo,
        nivel_riesgo: nivelRiesgo,
        porcentaje_caida: Number(porcentajeCaida.toFixed(2)),
        impacto_economico: Number(impactoEconomico.toFixed(2))
    };
};

/**
 * Validates a client's overall status for the Executive Dashboard.
 */
export const validateIntegrity = (assessment: RiskAssessment): boolean => {
    // Logic to ensure the assessment isn't yielding outliers due to corrupted metadata
    return assessment.porcentaje_caida < 100 && assessment.impacto_economico >= 0;
};
