/***************************************************************************
 * The contents of this file were generated with Amplify Studio.           *
 * Please refrain from making any modifications to this file.              *
 * Any changes to this file will be overwritten when running amplify pull. *
 **************************************************************************/

/* eslint-disable */
import * as React from "react";
import { Button, Flex, Grid, TextField } from "@aws-amplify/ui-react";
import { fetchByPath, getOverrideProps, validateField } from "./utils";
import { generateClient } from "aws-amplify/api";
import { createUser } from "../../src/graphql/mutations";
const client = generateClient();
export default function UserCreateForm(props) {
  const {
    clearOnSuccess = true,
    onSuccess,
    onError,
    onSubmit,
    onValidate,
    onChange,
    overrides,
    ...rest
  } = props;
  const initialValues = {
    username: "",
    email: "",
    givenName: "",
    dailyStreak: "",
    lastActive: "",
  };
  const [username, setUsername] = React.useState(initialValues.username);
  const [email, setEmail] = React.useState(initialValues.email);
  const [givenName, setGivenName] = React.useState(initialValues.givenName);
  const [dailyStreak, setDailyStreak] = React.useState(
    initialValues.dailyStreak
  );
  const [lastActive, setLastActive] = React.useState(initialValues.lastActive);
  const [errors, setErrors] = React.useState({});
  const resetStateValues = () => {
    setUsername(initialValues.username);
    setEmail(initialValues.email);
    setGivenName(initialValues.givenName);
    setDailyStreak(initialValues.dailyStreak);
    setLastActive(initialValues.lastActive);
    setErrors({});
  };
  const validations = {
    username: [{ type: "Required" }],
    email: [{ type: "Required" }],
    givenName: [{ type: "Required" }],
    dailyStreak: [{ type: "Required" }],
    lastActive: [{ type: "Required" }],
  };
  const runValidationTasks = async (
    fieldName,
    currentValue,
    getDisplayValue
  ) => {
    const value =
      currentValue && getDisplayValue
        ? getDisplayValue(currentValue)
        : currentValue;
    let validationResponse = validateField(value, validations[fieldName]);
    const customValidator = fetchByPath(onValidate, fieldName);
    if (customValidator) {
      validationResponse = await customValidator(value, validationResponse);
    }
    setErrors((errors) => ({ ...errors, [fieldName]: validationResponse }));
    return validationResponse;
  };
  const convertToLocal = (date) => {
    const df = new Intl.DateTimeFormat("default", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      calendar: "iso8601",
      numberingSystem: "latn",
      hourCycle: "h23",
    });
    const parts = df.formatToParts(date).reduce((acc, part) => {
      acc[part.type] = part.value;
      return acc;
    }, {});
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  };
  return (
    <Grid
      as="form"
      rowGap="15px"
      columnGap="15px"
      padding="20px"
      onSubmit={async (event) => {
        event.preventDefault();
        let modelFields = {
          username,
          email,
          givenName,
          dailyStreak,
          lastActive,
        };
        const validationResponses = await Promise.all(
          Object.keys(validations).reduce((promises, fieldName) => {
            if (Array.isArray(modelFields[fieldName])) {
              promises.push(
                ...modelFields[fieldName].map((item) =>
                  runValidationTasks(fieldName, item)
                )
              );
              return promises;
            }
            promises.push(
              runValidationTasks(fieldName, modelFields[fieldName])
            );
            return promises;
          }, [])
        );
        if (validationResponses.some((r) => r.hasError)) {
          return;
        }
        if (onSubmit) {
          modelFields = onSubmit(modelFields);
        }
        try {
          Object.entries(modelFields).forEach(([key, value]) => {
            if (typeof value === "string" && value === "") {
              modelFields[key] = null;
            }
          });
          await client.graphql({
            query: createUser.replaceAll("__typename", ""),
            variables: {
              input: {
                ...modelFields,
              },
            },
          });
          if (onSuccess) {
            onSuccess(modelFields);
          }
          if (clearOnSuccess) {
            resetStateValues();
          }
        } catch (err) {
          if (onError) {
            const messages = err.errors.map((e) => e.message).join("\n");
            onError(modelFields, messages);
          }
        }
      }}
      {...getOverrideProps(overrides, "UserCreateForm")}
      {...rest}
    >
      <TextField
        label="Username"
        isRequired={true}
        isReadOnly={false}
        value={username}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              username: value,
              email,
              givenName,
              dailyStreak,
              lastActive,
            };
            const result = onChange(modelFields);
            value = result?.username ?? value;
          }
          if (errors.username?.hasError) {
            runValidationTasks("username", value);
          }
          setUsername(value);
        }}
        onBlur={() => runValidationTasks("username", username)}
        errorMessage={errors.username?.errorMessage}
        hasError={errors.username?.hasError}
        {...getOverrideProps(overrides, "username")}
      ></TextField>
      <TextField
        label="Email"
        isRequired={true}
        isReadOnly={false}
        value={email}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              username,
              email: value,
              givenName,
              dailyStreak,
              lastActive,
            };
            const result = onChange(modelFields);
            value = result?.email ?? value;
          }
          if (errors.email?.hasError) {
            runValidationTasks("email", value);
          }
          setEmail(value);
        }}
        onBlur={() => runValidationTasks("email", email)}
        errorMessage={errors.email?.errorMessage}
        hasError={errors.email?.hasError}
        {...getOverrideProps(overrides, "email")}
      ></TextField>
      <TextField
        label="Given name"
        isRequired={true}
        isReadOnly={false}
        value={givenName}
        onChange={(e) => {
          let { value } = e.target;
          if (onChange) {
            const modelFields = {
              username,
              email,
              givenName: value,
              dailyStreak,
              lastActive,
            };
            const result = onChange(modelFields);
            value = result?.givenName ?? value;
          }
          if (errors.givenName?.hasError) {
            runValidationTasks("givenName", value);
          }
          setGivenName(value);
        }}
        onBlur={() => runValidationTasks("givenName", givenName)}
        errorMessage={errors.givenName?.errorMessage}
        hasError={errors.givenName?.hasError}
        {...getOverrideProps(overrides, "givenName")}
      ></TextField>
      <TextField
        label="Daily streak"
        isRequired={true}
        isReadOnly={false}
        type="number"
        step="any"
        value={dailyStreak}
        onChange={(e) => {
          let value = isNaN(parseInt(e.target.value))
            ? e.target.value
            : parseInt(e.target.value);
          if (onChange) {
            const modelFields = {
              username,
              email,
              givenName,
              dailyStreak: value,
              lastActive,
            };
            const result = onChange(modelFields);
            value = result?.dailyStreak ?? value;
          }
          if (errors.dailyStreak?.hasError) {
            runValidationTasks("dailyStreak", value);
          }
          setDailyStreak(value);
        }}
        onBlur={() => runValidationTasks("dailyStreak", dailyStreak)}
        errorMessage={errors.dailyStreak?.errorMessage}
        hasError={errors.dailyStreak?.hasError}
        {...getOverrideProps(overrides, "dailyStreak")}
      ></TextField>
      <TextField
        label="Last active"
        isRequired={true}
        isReadOnly={false}
        type="datetime-local"
        value={lastActive && convertToLocal(new Date(lastActive))}
        onChange={(e) => {
          let value =
            e.target.value === "" ? "" : new Date(e.target.value).toISOString();
          if (onChange) {
            const modelFields = {
              username,
              email,
              givenName,
              dailyStreak,
              lastActive: value,
            };
            const result = onChange(modelFields);
            value = result?.lastActive ?? value;
          }
          if (errors.lastActive?.hasError) {
            runValidationTasks("lastActive", value);
          }
          setLastActive(value);
        }}
        onBlur={() => runValidationTasks("lastActive", lastActive)}
        errorMessage={errors.lastActive?.errorMessage}
        hasError={errors.lastActive?.hasError}
        {...getOverrideProps(overrides, "lastActive")}
      ></TextField>
      <Flex
        justifyContent="space-between"
        {...getOverrideProps(overrides, "CTAFlex")}
      >
        <Button
          children="Clear"
          type="reset"
          onClick={(event) => {
            event.preventDefault();
            resetStateValues();
          }}
          {...getOverrideProps(overrides, "ClearButton")}
        ></Button>
        <Flex
          gap="15px"
          {...getOverrideProps(overrides, "RightAlignCTASubFlex")}
        >
          <Button
            children="Submit"
            type="submit"
            variation="primary"
            isDisabled={Object.values(errors).some((e) => e?.hasError)}
            {...getOverrideProps(overrides, "SubmitButton")}
          ></Button>
        </Flex>
      </Flex>
    </Grid>
  );
}
