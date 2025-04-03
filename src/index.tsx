/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { useEffect } from "react";
import lodash from "lodash";
import {
  type FieldPath,
  type FieldValues,
  get,
  set,
  type UseFormSetValue,
  type UseFormWatch,
} from "react-hook-form";
import flatten from "flat";

export type FormPersistConfig<TFieldValues extends FieldValues = FieldValues> =
  {
    storage?: Storage;
    watch: UseFormWatch<TFieldValues>;
    setValue: UseFormSetValue<TFieldValues>;
    exclude?: Array<FieldPath<TFieldValues>>;
    onDataRestored?: (data: Partial<TFieldValues>) => void;
    validate?: boolean;
    dirty?: boolean;
    touch?: boolean;
    onTimeout?: () => void;
    timeout?: number;
    defaultValues?: any;
  };

const useFormPersist = <TFieldValues extends FieldValues = FieldValues>(
  name: string,
  {
    storage,
    watch,
    setValue,
    exclude = [],
    onDataRestored,
    validate = false,
    dirty = false,
    touch = false,
    onTimeout = () => {},
    timeout,
    defaultValues,
  }: FormPersistConfig<TFieldValues>
) => {
  const watchedValues = watch();

  const getStorage = () => storage ?? window.sessionStorage;

  const clearStorage = () => {
    getStorage().removeItem(name);
  };

  useEffect(() => {
    const str = getStorage().getItem(name);
    const payload = str ? JSON.parse(str) : defaultValues;

    if (payload) {
      const { _timestamp = null }: { _timestamp: number | null } = payload;
      const { ...values }: Partial<TFieldValues> = payload;
      const restored: Partial<TFieldValues> = {};

      if (timeout && _timestamp && Date.now() - _timestamp > timeout) {
        onTimeout();
        clearStorage();
        return;
      }

      const paths = flatten<
        Partial<TFieldValues>,
        Record<FieldPath<TFieldValues>, TFieldValues[keyof TFieldValues]>
      >(values);
      // @ts-expect-error
      const entries: Array<
        [FieldPath<TFieldValues>, TFieldValues[keyof TFieldValues]]
      > = Object.entries(paths);

      entries
        .filter(
          ([key, value]) =>
            !exclude.includes(key) &&
            !lodash.isEqual(value, get(watchedValues, key))
        )
        .forEach(([key, value]) => {
          set(restored, key, value);

          setValue(key, value, {
            shouldValidate: validate,
            shouldDirty: dirty,
            shouldTouch: touch,
          });
        });

      if (onDataRestored) {
        onDataRestored(restored);
      }
    }
  }, [storage, name, onDataRestored, setValue, defaultValues]);

  useEffect(() => {
    const values = lodash(watchedValues)
      .omit(exclude)
      .omitBy((value) => typeof value === "object" && lodash.isEmpty(value))
      .value();

    if (!lodash.isEmpty(values)) {
      if (timeout !== undefined) {
        // @ts-expect-error
        values._timestamp = Date.now();
      }

      getStorage().setItem(name, JSON.stringify(values));
    }
  }, [watchedValues, timeout]);

  return {
    clear() {
      getStorage().removeItem(name);
    },
  };
};

export default useFormPersist;
