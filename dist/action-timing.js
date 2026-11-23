// Seconds from the accepted input. Release starts the outward gesture,
// cancelAfter marks the start of interruptible recovery, and the last key of
// the animation returns to the standing pose at duration.
const timing=(duration,release,cancelAfter,impacts=[])=>Object.freeze({
  duration,release,cancelAfter,impacts:Object.freeze(impacts)
});

const ordinary=timing(.39,.13,.285);
const common={
  attack:ordinary, cast:timing(.85,.22,.59), invoke:timing(3.38,.48,2.80,[.84,1.68,2.68]),
  dodge:timing(.44,.06,.30), charge:timing(.57,.06,.43), slash:timing(.83,.42,.66,[.42]),
  summon:timing(.55,.17,.43), hit:timing(.36,0,.20), dead:timing(.65,0,.65)
};
const roles={
  thunder:{ultimate:timing(3.02,.37,2.47,[.70,1.04,1.38,1.72,2.35])},
  sword:{
    cast:timing(3.10,.39,2.67,[1.10,1.55,2.00,2.58]),
    ultimate:timing(3.84,.49,3.22,[1.52,1.98,2.44,3.12])
  },
  ward:{
    cast:timing(2.86,.32,2.40,[.71,1.12,1.53,2.31]),
    ultimate:timing(3.26,.45,2.63,[2.50])
  },
  black:{cast:timing(1.12,.42,1.12),attack:timing(.57,.18,.43)},
  white:{cast:timing(1.35,.44,1.35,[1.35]),attack:timing(.55,.16,.42)},
  corpse:{cast:timing(.73,.26,.73),attack:timing(.33,.125,.25)},
  judge:{cast:common.summon,attack:common.slash}
};
export function actionTiming(role,pose){
  const school=role==='thunder-guard'?'thunder':role;
  return roles[school]?.[pose] || common[pose];
}
