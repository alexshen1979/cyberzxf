import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Composition,
  Img,
  Video,
  continueRender,
  delayRender,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

type Layout = '16x9' | '9x16';

type Creative = {
  id: '01' | '02' | '03';
  slug: string;
  hook: string;
  title: string[];
  subtitle: string;
  proof: string[];
  cards: string[];
  cta: string;
  accent: string;
  accent2: string;
  bg: string;
};

const FPS = 30;
const DURATION = 450;

const creatives: Creative[] = [
  {
    id: '01',
    slug: 'pre-score-plan',
    hook: '出分前',
    title: ['先做一版', '志愿预案'],
    subtitle: '把专业方向 院校层次 风险点提前看清',
    proof: ['输入预估分', '生成方案', '风险先筛'],
    cards: ['专业方向', '院校范围', '冲稳保预案'],
    cta: '现在打开小程序先准备',
    accent: '#2563eb',
    accent2: '#f97316',
    bg: 'linear-gradient(135deg, #f7fbff 0%, #e9f7f2 44%, #fff4e8 100%)',
  },
  {
    id: '02',
    slug: 'info-gap-qa',
    hook: '信息差',
    title: ['不懂就问', '一次讲清'],
    subtitle: '院校层次 城市资源 专业风险都能追问',
    proof: ['AI追问', '讲清逻辑', '少走弯路'],
    cards: ['院校层次', '城市资源', '风险解释'],
    cta: '志愿填报不迷茫',
    accent: '#7c3aed',
    accent2: '#06b6d4',
    bg: 'linear-gradient(135deg, #faf7ff 0%, #ebfbff 48%, #fff7ed 100%)',
  },
  {
    id: '03',
    slug: 'save-report',
    hook: '别等出分',
    title: ['报告先存好', '出分再调整'],
    subtitle: '候选池和分析报告提前备好 分数出来更从容',
    proof: ['报告留存', '候选池', '按位次调整'],
    cards: ['分析报告', '候选清单', '出分后微调'],
    cta: '提前准备填报更稳',
    accent: '#0f766e',
    accent2: '#e11d48',
    bg: 'linear-gradient(135deg, #f3fffb 0%, #f8f5ff 48%, #fff1f2 100%)',
  },
];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const ease = (value: number) => {
  const v = clamp(value, 0, 1);
  return 1 - Math.pow(1 - v, 3);
};

const fade = (frame: number, start: number, duration: number) => ease((frame - start) / duration);

const fontStack = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif';

const logo = staticFile('assets/brand-logo.png');

function Grain() {
  const {width, height} = useVideoConfig();
  const frame = useCurrentFrame();
  const dots = Array.from({length: 64});
  return (
    <AbsoluteFill style={{overflow: 'hidden', pointerEvents: 'none'}}>
      {dots.map((_, i) => {
        const x = random(`grain-x-${i}`) * width;
        const y = random(`grain-y-${i}`) * height;
        const size = 1 + random(`grain-s-${i}`) * 2.2;
        const opacity = 0.07 + 0.035 * Math.sin(frame * 0.08 + i);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              opacity,
              background: '#0f172a',
              borderRadius: 999,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
}

function Background({creative, layout}: {creative: Creative; layout: Layout}) {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const sweep = interpolate(frame, [20, 190, 360], [-width * 0.55, width * 1.1, width * 1.75], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{background: creative.bg, overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          width: width * 0.78,
          height: width * 0.78,
          left: layout === '16x9' ? width * 0.55 : width * 0.35,
          top: layout === '16x9' ? -height * 0.28 : -height * 0.1,
          borderRadius: '50%',
          background: creative.accent,
          filter: 'blur(90px)',
          opacity: 0.18,
          transform: `translate(${Math.sin(frame / 52) * 34}px, ${Math.cos(frame / 57) * 28}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: width * 0.5,
          height: width * 0.5,
          left: layout === '16x9' ? width * 0.05 : -width * 0.18,
          top: layout === '16x9' ? height * 0.62 : height * 0.62,
          borderRadius: '50%',
          background: creative.accent2,
          filter: 'blur(100px)',
          opacity: 0.15,
          transform: `translate(${Math.cos(frame / 45) * 24}px, ${Math.sin(frame / 48) * 22}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.76) 45%, rgba(255,255,255,0) 100%)',
          width: width * 0.35,
          transform: `translateX(${sweep}px) skewX(-18deg)`,
          opacity: 0.48,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(15,23,42,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.045) 1px, transparent 1px)',
          backgroundSize: layout === '16x9' ? '74px 74px' : '64px 64px',
          maskImage: 'radial-gradient(circle at 52% 40%, black 0%, transparent 72%)',
          opacity: 0.65,
        }}
      />
      <Grain />
    </AbsoluteFill>
  );
}

function BrandMark({layout}: {layout: Layout}) {
  const frame = useCurrentFrame();
  const intro = spring({frame, fps: FPS, config: {damping: 18, stiffness: 140}});
  const size = layout === '16x9' ? 70 : 72;
  const left = layout === '16x9' ? 72 : 58;
  const top = layout === '16x9' ? 58 : 62;
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        display: 'flex',
        alignItems: 'center',
        gap: 18,
        opacity: intro,
        transform: `translateY(${(1 - intro) * -16}px)`,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 18,
          background: 'rgba(255,255,255,0.84)',
          boxShadow: '0 16px 42px rgba(15,23,42,0.14)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <Img src={logo} style={{width: size - 18, height: size - 18, borderRadius: 13}} />
      </div>
      <div
        style={{
          fontFamily: fontStack,
          color: '#172554',
          fontWeight: 700,
          fontSize: layout === '16x9' ? 34 : 32,
          letterSpacing: 0,
          textShadow: '0 2px 12px rgba(255,255,255,0.8)',
        }}
      >
        赛博张老师知识库
      </div>
    </div>
  );
}

function KineticTitle({creative, layout}: {creative: Creative; layout: Layout}) {
  const frame = useCurrentFrame();
  const mainSize = layout === '16x9' ? 124 : 112;
  const hookSize = layout === '16x9' ? 58 : 54;
  const left = layout === '16x9' ? 76 : 58;
  const top = layout === '16x9' ? 170 : 178;
  const compact = layout === '9x16';
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: compact ? 650 : 780,
        fontFamily: fontStack,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          padding: layout === '16x9' ? '13px 24px' : '12px 22px',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.78)',
          boxShadow: '0 16px 36px rgba(15,23,42,0.11)',
          color: creative.accent,
          fontWeight: 900,
          fontSize: hookSize,
          lineHeight: 1,
          letterSpacing: 0,
          opacity: fade(frame, 8, 14),
          transform: `translateY(${(1 - fade(frame, 8, 14)) * 20}px) scale(${0.94 + fade(frame, 8, 14) * 0.06})`,
        }}
      >
        {creative.hook}
      </div>
      <div style={{height: layout === '16x9' ? 30 : 26}} />
      {creative.title.map((line, index) => {
        const start = 24 + index * 8;
        const p = spring({frame: frame - start, fps: FPS, config: {damping: 18, stiffness: 130}});
        return (
          <div
            key={line}
            style={{
              fontSize: mainSize,
              lineHeight: 1.03,
              fontWeight: 950,
              color: '#0f172a',
              letterSpacing: 0,
              opacity: p,
              transform: `translateX(${(1 - p) * -46}px)`,
              textShadow: '0 8px 22px rgba(255,255,255,0.72)',
            }}
          >
            {line}
          </div>
        );
      })}
      <div
        style={{
          marginTop: 26,
          width: layout === '16x9' ? 620 : 610,
          fontSize: layout === '16x9' ? 37 : 34,
          lineHeight: 1.35,
          fontWeight: 650,
          color: '#475569',
          letterSpacing: 0,
          opacity: fade(frame, 54, 16),
          transform: `translateY(${(1 - fade(frame, 54, 16)) * 20}px)`,
        }}
      >
        {creative.subtitle}
      </div>
    </div>
  );
}

function PhoneShell({
  creative,
  layout,
  scale = 1,
}: {
  creative: Creative;
  layout: Layout;
  scale?: number;
}) {
  const frame = useCurrentFrame();
  const phoneW = layout === '16x9' ? 330 * scale : 430 * scale;
  const phoneH = phoneW * (960 / 448);
  const border = 15 * scale;
  const radius = 44 * scale;
  const product = staticFile(`assets/product/${creative.id}.mp4`);
  const entrance = spring({frame: frame - 38, fps: FPS, config: {damping: 19, stiffness: 115}});
  const yFloat = Math.sin(frame / 38) * 9 * scale;
  return (
    <div
      style={{
        width: phoneW + border * 2,
        height: phoneH + border * 2,
        borderRadius: radius + border,
        padding: border,
        background: '#0f172a',
        boxShadow: `0 ${28 * scale}px ${76 * scale}px rgba(15,23,42,0.26), inset 0 0 0 2px rgba(255,255,255,0.15)`,
        transform: `translateY(${(1 - entrance) * 60 + yFloat}px) rotate(${layout === '16x9' ? -2 : 0}deg) scale(${0.88 + entrance * 0.12})`,
        opacity: entrance,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 18 * scale,
          left: '50%',
          width: 92 * scale,
          height: 18 * scale,
          borderRadius: 999,
          background: '#020617',
          transform: 'translateX(-50%)',
          zIndex: 3,
        }}
      />
      <Video
        src={product}
        muted
        style={{
          width: phoneW,
          height: phoneH,
          borderRadius: radius,
          objectFit: 'cover',
          background: '#ffffff',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: border,
          borderRadius: radius,
          boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.34)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: phoneW * 0.56,
          height: phoneH * 1.1,
          left: -phoneW * 0.55 + interpolate(frame, [62, 170], [0, phoneW * 1.55], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
          top: -phoneH * 0.04,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.32), transparent)',
          transform: 'skewX(-18deg)',
          opacity: 0.75,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

function ProductStage({creative, layout}: {creative: Creative; layout: Layout}) {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const start = 62;
  const p = spring({frame: frame - start, fps: FPS, config: {damping: 22, stiffness: 120}});
  const left = layout === '16x9' ? width - 574 : (width - 472) / 2;
  const top = layout === '16x9' ? 76 : 704;
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        transform: `translateY(${(1 - p) * 50}px) scale(${0.9 + p * 0.1})`,
        opacity: p,
      }}
    >
      <PhoneShell creative={creative} layout={layout} scale={layout === '16x9' ? 1 : 1} />
      <HighlightRings creative={creative} layout={layout} />
    </div>
  );
}

function HighlightRings({creative, layout}: {creative: Creative; layout: Layout}) {
  const frame = useCurrentFrame();
  const rings = [
    {start: 142, x: layout === '16x9' ? -70 : -54, y: layout === '16x9' ? 230 : 250, label: creative.proof[0]},
    {start: 208, x: layout === '16x9' ? -104 : -54, y: layout === '16x9' ? 430 : 474, label: creative.proof[1]},
    {start: 286, x: layout === '16x9' ? -84 : -54, y: layout === '16x9' ? 610 : 710, label: creative.proof[2]},
  ];
  return (
    <>
      {rings.map((ring, i) => {
        const p = fade(frame, ring.start, 12) * (1 - fade(frame, ring.start + 55, 16));
        const pulse = 1 + Math.sin((frame - ring.start) / 7) * 0.035;
        return (
          <div
            key={ring.label}
            style={{
              position: 'absolute',
              left: ring.x,
              top: ring.y,
              opacity: p,
              transform: `scale(${pulse}) translateX(${(1 - p) * -20}px)`,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              fontFamily: fontStack,
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 999,
                border: `5px solid ${i === 1 ? creative.accent2 : creative.accent}`,
                background: 'rgba(255,255,255,0.9)',
                boxShadow: `0 0 0 ${8 + Math.sin(frame / 5) * 2}px rgba(255,255,255,0.46)`,
              }}
            />
            <div
              style={{
                padding: '13px 20px',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.9)',
                color: '#0f172a',
                fontSize: layout === '16x9' ? 30 : 29,
                fontWeight: 900,
                boxShadow: '0 18px 38px rgba(15,23,42,0.13)',
                whiteSpace: 'nowrap',
              }}
            >
              {ring.label}
            </div>
          </div>
        );
      })}
    </>
  );
}

function ProductPulse({creative, layout}: {creative: Creative; layout: Layout}) {
  const frame = useCurrentFrame();
  const {width} = useVideoConfig();
  const left = layout === '16x9' ? 740 : 542;
  const top = layout === '16x9' ? 538 : 600;
  const p = fade(frame, layout === '16x9' ? 30 : 118, 18) * (1 - fade(frame, 340, 24));
  const widthBox = layout === '16x9' ? 430 : 430;
  const steps = creative.proof;
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        width: widthBox,
        opacity: p,
        transform: `translateY(${(1 - p) * 22}px)`,
        fontFamily: fontStack,
      }}
    >
      <div
        style={{
          height: layout === '16x9' ? 106 : 90,
          borderRadius: 28,
          background: 'rgba(255,255,255,0.76)',
          boxShadow: '0 22px 54px rgba(15,23,42,0.12)',
          border: '1px solid rgba(255,255,255,0.7)',
          padding: layout === '16x9' ? '22px 24px' : '16px 18px',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: -widthBox * 0.25 + interpolate(frame, [42, 180], [0, widthBox * 1.2], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            }),
            top: 0,
            width: widthBox * 0.28,
            height: '100%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.72), transparent)',
            transform: 'skewX(-18deg)',
          }}
        />
        <div style={{fontSize: layout === '16x9' ? 24 : 24, color: '#64748b', fontWeight: 800}}>填报前先理清</div>
        <div style={{height: layout === '16x9' ? 14 : 10}} />
        <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
          {steps.map((step, index) => {
            const active = frame > 72 + index * 54;
            const fill = fade(frame, 72 + index * 54, 20);
            return (
              <React.Fragment key={step}>
                <div
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    minWidth: layout === '16x9' ? 82 : 76,
                    height: layout === '16x9' ? 34 : 32,
                    borderRadius: 999,
                    background: active ? creative.accent : 'rgba(15,23,42,0.08)',
                    color: active ? 'white' : '#475569',
                    fontSize: layout === '16x9' ? 19 : 17,
                    fontWeight: 900,
                    transform: `scale(${0.94 + fill * 0.06})`,
                  }}
                >
                  {step}
                </div>
                {index < steps.length - 1 ? (
                  <div
                    style={{
                      width: layout === '16x9' ? 28 : 18,
                      height: 4,
                      borderRadius: 999,
                      background: `linear-gradient(90deg, ${creative.accent} ${fill * 100}%, rgba(15,23,42,0.12) ${fill * 100}%)`,
                    }}
                  />
                ) : null}
              </React.Fragment>
            );
          })}
        </div>
      </div>
      {layout === '16x9' ? (
        <div
          style={{
            marginTop: 14,
            display: 'flex',
            gap: 8,
            color: '#475569',
            fontSize: 22,
            fontWeight: 750,
          }}
        >
          <span style={{color: creative.accent, fontWeight: 950}}>AI</span>
          <span>把专业 院校 风险拆开看</span>
        </div>
      ) : null}
    </div>
  );
}

function FloatingCards({creative, layout}: {creative: Creative; layout: Layout}) {
  const frame = useCurrentFrame();
  const baseLeft = layout === '16x9' ? 84 : 58;
  const baseTop = layout === '16x9' ? 706 : 1276;
  const cardW = layout === '16x9' ? 198 : 190;
  return (
    <div style={{position: 'absolute', left: baseLeft, top: baseTop, display: 'flex', gap: layout === '16x9' ? 18 : 14}}>
      {creative.cards.map((card, index) => {
        const p = spring({frame: frame - (layout === '16x9' ? 82 : 170) - index * 11, fps: FPS, config: {damping: 17, stiffness: 120}});
        return (
          <div
            key={card}
            style={{
              width: cardW,
              height: layout === '16x9' ? 122 : 96,
              borderRadius: 26,
              background: 'rgba(255,255,255,0.78)',
              boxShadow: '0 22px 48px rgba(15,23,42,0.12)',
              border: '1px solid rgba(255,255,255,0.72)',
              transform: `translateY(${(1 - p) * 42 + Math.sin(frame / 40 + index) * 5}px)`,
              opacity: p,
              padding: layout === '16x9' ? 20 : 16,
              fontFamily: fontStack,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                width: 38,
                height: 8,
                borderRadius: 99,
                background: index === 1 ? creative.accent2 : creative.accent,
              }}
            />
            <div style={{fontSize: layout === '16x9' ? 30 : 25, color: '#0f172a', fontWeight: 900, lineHeight: 1.12}}>{card}</div>
          </div>
        );
      })}
    </div>
  );
}

function ProofLine({creative, layout}: {creative: Creative; layout: Layout}) {
  const frame = useCurrentFrame();
  const p = fade(frame, 224, 18) * (1 - fade(frame, 358, 20));
  const left = layout === '16x9' ? 76 : 58;
  const top = layout === '16x9' ? 880 : 1388;
  return (
    <div
      style={{
        position: 'absolute',
        left,
        top,
        display: 'flex',
        gap: 14,
        alignItems: 'center',
        opacity: p,
        transform: `translateY(${(1 - p) * 20}px)`,
        fontFamily: fontStack,
      }}
    >
      {creative.proof.map((item, i) => (
        <React.Fragment key={item}>
          <div
            style={{
              padding: layout === '16x9' ? '14px 21px' : '12px 15px',
              borderRadius: 999,
              background: i === 1 ? creative.accent2 : creative.accent,
              color: 'white',
              fontSize: layout === '16x9' ? 28 : 24,
              fontWeight: 900,
              boxShadow: '0 14px 34px rgba(15,23,42,0.16)',
            }}
          >
            {item}
          </div>
          {i < creative.proof.length - 1 ? (
            <div style={{width: 24, height: 3, borderRadius: 99, background: 'rgba(15,23,42,0.2)'}} />
          ) : null}
        </React.Fragment>
      ))}
    </div>
  );
}

function ClosingCta({creative, layout}: {creative: Creative; layout: Layout}) {
  const frame = useCurrentFrame();
  const p = spring({frame: frame - 372, fps: FPS, config: {damping: 18, stiffness: 120}});
  const {width, height} = useVideoConfig();
  return (
    <div
      style={{
        position: 'absolute',
        left: layout === '16x9' ? 70 : 54,
        right: layout === '16x9' ? 70 : 54,
        bottom: layout === '16x9' ? 72 : 76,
        height: layout === '16x9' ? 128 : 154,
        borderRadius: layout === '16x9' ? 34 : 36,
        background: 'rgba(15,23,42,0.93)',
        boxShadow: '0 26px 70px rgba(15,23,42,0.26)',
        opacity: p,
        transform: `translateY(${(1 - p) * 70}px)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: layout === '16x9' ? '0 38px' : '0 28px',
        fontFamily: fontStack,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: interpolate(frame, [380, 438], [-width * 0.25, width * 0.85], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
          width: width * 0.26,
          height: height * 0.2,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.24), transparent)',
          transform: 'skewX(-18deg)',
        }}
      />
      <div style={{display: 'flex', alignItems: 'center', gap: 20, position: 'relative'}}>
        <Img src={logo} style={{width: layout === '16x9' ? 70 : 68, height: layout === '16x9' ? 70 : 68, borderRadius: 17}} />
        <div>
          <div style={{color: 'white', fontSize: layout === '16x9' ? 42 : 42, fontWeight: 950, lineHeight: 1.1}}>
            {creative.cta}
          </div>
          <div style={{color: 'rgba(255,255,255,0.72)', fontSize: layout === '16x9' ? 22 : 23, fontWeight: 650, marginTop: 8}}>
            打破信息差 志愿填报不迷茫
          </div>
        </div>
      </div>
      <div
        style={{
          position: 'relative',
          width: layout === '16x9' ? 112 : 96,
          height: layout === '16x9' ? 112 : 96,
          borderRadius: 28,
          background: `linear-gradient(135deg, ${creative.accent}, ${creative.accent2})`,
          display: 'grid',
          placeItems: 'center',
          color: 'white',
          fontSize: layout === '16x9' ? 48 : 44,
          fontWeight: 950,
          boxShadow: `0 0 40px ${creative.accent}66`,
        }}
      >
        GO
      </div>
    </div>
  );
}

function SharpPhone({creative, layout}: {creative: Creative; layout: Layout}) {
  const frame = useCurrentFrame();
  const screenW = 448;
  const screenH = 960;
  const border = layout === '16x9' ? 16 : 15;
  const radius = 44;
  const product = staticFile(`assets/product/${creative.id}.mp4`);
  const p = fade(frame, 42, 16);

  return (
    <div
      style={{
        position: 'absolute',
        left: layout === '16x9' ? 1354 : 301,
        top: layout === '16x9' ? 44 : 682,
        width: screenW + border * 2,
        height: screenH + border * 2,
        borderRadius: radius + border,
        padding: border,
        background: '#0f172a',
        boxShadow: '0 28px 72px rgba(15,23,42,0.24), inset 0 0 0 2px rgba(255,255,255,0.14)',
        opacity: p,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 18,
          left: '50%',
          width: 92,
          height: 18,
          borderRadius: 999,
          background: '#020617',
          transform: 'translateX(-50%)',
          zIndex: 3,
        }}
      />
      <Video
        src={product}
        muted
        style={{
          width: screenW,
          height: screenH,
          borderRadius: radius,
          objectFit: 'cover',
          background: '#ffffff',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: border,
          borderRadius: radius,
          boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.32)',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

function SharpCards({creative, layout}: {creative: Creative; layout: Layout}) {
  const frame = useCurrentFrame();
  const baseLeft = layout === '16x9' ? 84 : 58;
  const baseTop = layout === '16x9' ? 712 : 584;
  const cardW = layout === '16x9' ? 206 : 196;
  const cardH = layout === '16x9' ? 116 : 80;

  return (
    <div style={{position: 'absolute', left: baseLeft, top: baseTop, display: 'flex', gap: layout === '16x9' ? 18 : 14}}>
      {creative.cards.map((card, index) => {
        const p = spring({frame: frame - 86 - index * 10, fps: FPS, config: {damping: 18, stiffness: 120}});
        return (
          <div
            key={card}
            style={{
              width: cardW,
              height: cardH,
              borderRadius: 24,
              background: 'rgba(255,255,255,0.82)',
              boxShadow: '0 20px 44px rgba(15,23,42,0.12)',
              border: '1px solid rgba(255,255,255,0.76)',
              opacity: p,
              transform: `translateY(${(1 - p) * 30}px)`,
              padding: layout === '16x9' ? 20 : 16,
              fontFamily: fontStack,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                width: 38,
                height: 8,
                borderRadius: 99,
                background: index === 1 ? creative.accent2 : creative.accent,
              }}
            />
            <div style={{fontSize: layout === '16x9' ? 30 : 24, color: '#0f172a', fontWeight: 900, lineHeight: 1.12}}>{card}</div>
          </div>
        );
      })}
    </div>
  );
}

function SharpSideProof({creative, layout}: {creative: Creative; layout: Layout}) {
  const frame = useCurrentFrame();
  if (layout !== '16x9') {
    return null;
  }
  const p = fade(frame, 148, 18) * (1 - fade(frame, 340, 24));
  return (
    <div
      style={{
        position: 'absolute',
        left: 828,
        top: 96,
        width: 438,
        opacity: p,
        fontFamily: fontStack,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        {['出分前准备', '专业方向', '院校城市', '风险清单'].map((item, i) => (
          <div
            key={item}
            style={{
              padding: '12px 18px',
              borderRadius: 999,
              background: i % 2 === 0 ? 'rgba(255,255,255,0.86)' : 'rgba(15,23,42,0.86)',
              color: i % 2 === 0 ? '#0f172a' : '#ffffff',
              fontSize: 24,
              fontWeight: 850,
              boxShadow: '0 14px 30px rgba(15,23,42,0.11)',
            }}
          >
            {item}
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 28,
          height: 116,
          borderRadius: 28,
          background: 'rgba(255,255,255,0.78)',
          boxShadow: '0 22px 54px rgba(15,23,42,0.12)',
          border: '1px solid rgba(255,255,255,0.7)',
          padding: '24px 26px',
        }}
      >
        <div style={{fontSize: 24, color: '#64748b', fontWeight: 800}}>填报前先理清</div>
        <div style={{height: 16}} />
        <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
          {creative.proof.map((step, index) => {
            const active = frame > 72 + index * 54;
            return (
              <React.Fragment key={step}>
                <div
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    minWidth: 86,
                    height: 36,
                    borderRadius: 999,
                    background: active ? creative.accent : 'rgba(15,23,42,0.08)',
                    color: active ? 'white' : '#475569',
                    fontSize: 19,
                    fontWeight: 900,
                  }}
                >
                  {step}
                </div>
                {index < creative.proof.length - 1 ? <div style={{width: 24, height: 4, borderRadius: 999, background: 'rgba(15,23,42,0.12)'}} /> : null}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SharpClosingCta({creative, layout}: {creative: Creative; layout: Layout}) {
  const frame = useCurrentFrame();
  const p = spring({frame: frame - 372, fps: FPS, config: {damping: 18, stiffness: 120}});
  const {width, height} = useVideoConfig();
  const isWide = layout === '16x9';
  return (
    <div
      style={{
        position: 'absolute',
        left: isWide ? 70 : 54,
        width: isWide ? 738 : undefined,
        right: isWide ? undefined : 54,
        bottom: isWide ? 72 : 76,
        height: isWide ? 128 : 154,
        borderRadius: isWide ? 34 : 36,
        background: 'rgba(15,23,42,0.93)',
        boxShadow: '0 26px 70px rgba(15,23,42,0.26)',
        opacity: p,
        transform: `translateY(${(1 - p) * 70}px)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isWide ? '0 34px' : '0 28px',
        fontFamily: fontStack,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: interpolate(frame, [380, 438], [-width * 0.25, width * 0.85], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          }),
          width: width * 0.26,
          height: height * 0.2,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.24), transparent)',
          transform: 'skewX(-18deg)',
        }}
      />
      <div style={{display: 'flex', alignItems: 'center', gap: 20, position: 'relative'}}>
        <Img src={logo} style={{width: isWide ? 70 : 68, height: isWide ? 70 : 68, borderRadius: 17}} />
        <div>
          <div style={{color: 'white', fontSize: isWide ? 39 : 42, fontWeight: 950, lineHeight: 1.1}}>
            {creative.cta}
          </div>
          <div style={{color: 'rgba(255,255,255,0.72)', fontSize: isWide ? 21 : 23, fontWeight: 650, marginTop: 8}}>
            打破信息差 志愿填报不迷茫
          </div>
        </div>
      </div>
      <div
        style={{
          position: 'relative',
          width: isWide ? 96 : 96,
          height: isWide ? 96 : 96,
          borderRadius: 26,
          background: `linear-gradient(135deg, ${creative.accent}, ${creative.accent2})`,
          display: 'grid',
          placeItems: 'center',
          color: 'white',
          fontSize: isWide ? 42 : 44,
          fontWeight: 950,
          boxShadow: `0 0 40px ${creative.accent}66`,
        }}
      >
        GO
      </div>
    </div>
  );
}

function SceneChips({creative, layout}: {creative: Creative; layout: Layout}) {
  const frame = useCurrentFrame();
  const {width} = useVideoConfig();
  const top = layout === '16x9' ? 70 : 1016;
  const items = ['出分前准备', '专业方向', '院校城市', '风险清单'];
  return (
    <div
      style={{
        position: 'absolute',
        left: layout === '16x9' ? width * 0.44 : 58,
        top,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 13,
        width: layout === '16x9' ? 520 : 520,
        fontFamily: fontStack,
      }}
    >
      {items.map((item, i) => {
        const p = fade(frame, 165 + i * 9, 14) * (1 - fade(frame, 342, 18));
        return (
          <div
            key={item}
            style={{
              padding: layout === '16x9' ? '12px 18px' : '11px 16px',
              borderRadius: 999,
              background: i % 2 === 0 ? 'rgba(255,255,255,0.82)' : 'rgba(15,23,42,0.84)',
              color: i % 2 === 0 ? '#0f172a' : '#ffffff',
              fontSize: layout === '16x9' ? 24 : 24,
              fontWeight: 850,
              boxShadow: '0 14px 30px rgba(15,23,42,0.11)',
              opacity: p,
              transform: `translateY(${(1 - p) * -16}px)`,
            }}
          >
            {item}
          </div>
        );
      })}
    </div>
  );
}

function PremiumAd({creative, layout}: {creative: Creative; layout: Layout}) {
  const audio = staticFile(`assets/audio/${creative.id}.m4a`);
  const frame = useCurrentFrame();
  const [handle] = React.useState(() => delayRender('asset-preload'));

  React.useEffect(() => {
    const timer = setTimeout(() => continueRender(handle), 200);
    return () => clearTimeout(timer);
  }, [handle]);

  return (
    <AbsoluteFill style={{fontFamily: fontStack}}>
      <Background creative={creative} layout={layout} />
      <Audio src={audio} volume={0.95} />
      <BrandMark layout={layout} />
      <KineticTitle creative={creative} layout={layout} />
      <FloatingCards creative={creative} layout={layout} />
      <ProductPulse creative={creative} layout={layout} />
      <ProductStage creative={creative} layout={layout} />
      <SceneChips creative={creative} layout={layout} />
      <ProofLine creative={creative} layout={layout} />
      <ClosingCta creative={creative} layout={layout} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          border: `${layout === '16x9' ? 22 : 18}px solid rgba(255,255,255,${0.08 + Math.sin(frame / 24) * 0.015})`,
        }}
      />
    </AbsoluteFill>
  );
}

function SharpNoVoiceAd({creative, layout}: {creative: Creative; layout: Layout}) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{fontFamily: fontStack}}>
      <Background creative={creative} layout={layout} />
      <BrandMark layout={layout} />
      <KineticTitle creative={creative} layout={layout} />
      <SharpCards creative={creative} layout={layout} />
      <SharpSideProof creative={creative} layout={layout} />
      <SharpPhone creative={creative} layout={layout} />
      <SharpClosingCta creative={creative} layout={layout} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          border: `${layout === '16x9' ? 22 : 18}px solid rgba(255,255,255,${0.08 + Math.sin(frame / 24) * 0.015})`,
        }}
      />
    </AbsoluteFill>
  );
}

export const Root: React.FC = () => {
  return (
    <>
      {creatives.map((creative) => (
        <React.Fragment key={creative.id}>
          <Composition
            id={`${creative.id}-${creative.slug}-16x9-premium`}
            component={() => <PremiumAd creative={creative} layout="16x9" />}
            durationInFrames={DURATION}
            fps={FPS}
            width={1920}
            height={1080}
          />
          <Composition
            id={`${creative.id}-${creative.slug}-9x16-premium`}
            component={() => <PremiumAd creative={creative} layout="9x16" />}
            durationInFrames={DURATION}
            fps={FPS}
            width={1080}
            height={1920}
          />
          <Composition
            id={`${creative.id}-${creative.slug}-16x9-sharp-no-voice`}
            component={() => <SharpNoVoiceAd creative={creative} layout="16x9" />}
            durationInFrames={DURATION}
            fps={FPS}
            width={1920}
            height={1080}
          />
          <Composition
            id={`${creative.id}-${creative.slug}-9x16-sharp-no-voice`}
            component={() => <SharpNoVoiceAd creative={creative} layout="9x16" />}
            durationInFrames={DURATION}
            fps={FPS}
            width={1080}
            height={1920}
          />
        </React.Fragment>
      ))}
    </>
  );
};
