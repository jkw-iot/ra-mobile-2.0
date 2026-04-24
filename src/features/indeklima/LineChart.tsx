// ══════════════════════════════════════════════════════════════
// LineChart — minimal time-series chart for sensor history.
//
// Uses react-native-svg directly. No chart library — keeps the
// bundle small and lets us match the web app's visual tone pixel-
// for-pixel (dusty palette, thin stroke, subtle grid).
// ══════════════════════════════════════════════════════════════
import { View, Text } from 'react-native';
import Svg, { Polyline, Line, Text as SvgText } from 'react-native-svg';

import { colors, type } from '@/theme';

export interface LinePoint {
  t: number;  // unix ms
  v: number | null;
}

export interface LineChartProps {
  points: readonly LinePoint[];
  width: number;
  height?: number;
  stroke?: string;
  unit?: string;
}

export function LineChart({
  points,
  width,
  height = 180,
  stroke = colors.dusty[0],
  unit,
}: LineChartProps) {
  const valid = points.filter((p): p is LinePoint & { v: number } => p.v != null);
  if (valid.length < 2) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={type.caption}>—</Text>
      </View>
    );
  }

  const padX = 8;
  const padTop = 10;
  const padBottom = 20;

  const minT = valid[0]!.t;
  const maxT = valid[valid.length - 1]!.t;
  const tSpan = Math.max(1, maxT - minT);

  const values = valid.map((p) => p.v);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const vSpan = Math.max(0.001, maxV - minV);

  const plotW = width - padX * 2;
  const plotH = height - padTop - padBottom;

  const toX = (t: number) => padX + ((t - minT) / tSpan) * plotW;
  const toY = (v: number) => padTop + plotH - ((v - minV) / vSpan) * plotH;

  const pointStr = valid.map((p) => `${toX(p.t)},${toY(p.v)}`).join(' ');

  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((r) => padTop + plotH * r);

  return (
    <View>
      <Svg width={width} height={height}>
        {gridYs.map((y, i) => (
          <Line
            key={i}
            x1={padX}
            x2={width - padX}
            y1={y}
            y2={y}
            stroke={colors.gray[200]}
            strokeWidth={1}
          />
        ))}
        <Polyline
          points={pointStr}
          fill="none"
          stroke={stroke}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <SvgText
          x={padX}
          y={padTop + 4}
          fontSize={10}
          fill={colors.gray[500]}
        >
          {maxV.toFixed(1)}
          {unit ? ` ${unit}` : ''}
        </SvgText>
        <SvgText
          x={padX}
          y={padTop + plotH}
          fontSize={10}
          fill={colors.gray[500]}
        >
          {minV.toFixed(1)}
          {unit ? ` ${unit}` : ''}
        </SvgText>
      </Svg>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingHorizontal: padX,
          marginTop: -4,
        }}
      >
        <Text style={[type.caption, { fontSize: 10 }]}>
          {new Date(minT).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
        <Text style={[type.caption, { fontSize: 10 }]}>
          {new Date(maxT).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  );
}

export default LineChart;
