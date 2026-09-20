/**
 * 盒型注册表：所有盒型 builder 的统一入口
 * 新增盒型 = 新建 builder 文件 + 在此注册
 */
import { BoxParams, FieldSpec } from './params';
import { DielineResult } from './types';
import { fefco0201 } from './builders/fefco0201';
import { fefco0200 } from './builders/fefco0200';
import { fefco0202 } from './builders/fefco0202';
import { fefco0203 } from './builders/fefco0203';
import { shortFlapBox } from './builders/shortFlapBox';
import { windowBox } from './builders/windowBox';
import { mailer0427 } from './builders/mailer0427';
import { mailerFlat } from './builders/mailerFlat';
import { mailerDouble } from './builders/mailerDouble';
import { autobottom0700 } from './builders/autobottom0700';
import { pillowBox } from './builders/pillowBox';
import { tuckTuckBox } from './builders/tuckTuckBox';
import { reverseTuck } from './builders/reverseTuck';
import { boxLid } from './builders/boxLid';
import { drawerBox } from './builders/drawerBox';
import { cakeBox } from './builders/cakeBox';
import { fruitBox } from './builders/fruitBox';
import { onePageBox } from './builders/onePageBox';
import { bookBox } from './builders/bookBox';
import { rollTray0422, rollTray0421, trayEarlock427 } from './builders/rollTray';
import { bookWrap } from './builders/bookWrap';
import { hexBox } from './builders/hexBox';
import { handleBox } from './builders/handleBox';

export interface BoxBuilder {
  id: string;
  name: string;
  category: string;
  /** 参数面板字段声明（声明式渲染） */
  fields: FieldSpec[];
  build: (p: BoxParams) => DielineResult;
}

export const REGISTRY: BoxBuilder[] = [
  // 瓦楞纸箱（FEFCO 02xx 开槽箱系）
  fefco0201,
  fefco0200,
  fefco0202,
  fefco0203,
  shortFlapBox,
  windowBox,
  fruitBox,
  rollTray0422,
  rollTray0421,
  trayEarlock427,
  handleBox,
  // 快递 / 电商
  mailer0427,
  mailerFlat,
  mailerDouble,
  cakeBox,
  onePageBox,
  bookWrap,
  // 折叠纸盒（卡纸/彩盒）
  tuckTuckBox,
  reverseTuck,
  autobottom0700,
  pillowBox,
  // 礼盒 / 组合结构
  boxLid,
  drawerBox,
  bookBox,
  hexBox,
];

export const DEFAULT_BOX_ID = 'fefco-0201';

export function getBuilder(id: string): BoxBuilder {
  return REGISTRY.find((b) => b.id === id) ?? REGISTRY[0];
}
